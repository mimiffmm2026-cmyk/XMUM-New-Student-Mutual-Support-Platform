#!/usr/bin/env bash
set -euo pipefail

runner_temp=${RUNNER_TEMP:-${TMPDIR:-/tmp}}
artifact_directory=${BROWSER_ARTIFACT_DIR:-"$runner_temp/browser-artifacts"}
scratch_parent=${BROWSER_FIXTURE_DIR:-"$runner_temp"}
run_directory=
fixture_directory=
chrome_profile_root=
startup_log_directory=
artifact_run_directory=
run_token=
cdp_base_url=${CDP_URL:-http://127.0.0.1:9344}
dev_base_url=${BROWSER_DEV_URL:-http://localhost:4173}
chromium_path=${CHROMIUM_PATH:-}
chrome_pid=
chrome_profile=
dev_pid=

run_logged() {
  local name=$1
  shift
  local log_file="$artifact_run_directory/$name.log"

  echo "=== $name ==="
  set +e
  "$@" 2>&1 | tee "$log_file"
  local command_status=${PIPESTATUS[0]}
  set -e
  return "$command_status"
}

require_alive() {
  if ! kill -0 "$1" 2>/dev/null; then
    echo "$2 启动进程已退出，拒绝使用已有服务。" >&2
    return 1
  fi
}

require_unused_url() {
  # Any HTTP response, including 404/500, means this endpoint is already owned.
  if curl --silent --max-time 2 --output /dev/null "$1"; then
    echo "$2 端口已被服务占用：$1" >&2
    return 1
  fi
}

wait_for_url() {
  local url=$1
  local description=$2
  local pid=$3
  local attempts=${4:-60}
  local attempt

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    require_alive "$pid" "$description" || return 1
    if curl --fail --silent --show-error --max-time 2 "$url" >/dev/null; then
      require_alive "$pid" "$description" || return 1
      echo "$description 已就绪：$url"
      return 0
    fi
    sleep 1
  done

  echo "$description 启动超时：$url" >&2
  return 1
}

wait_for_chrome() {
  local log_file=$1
  local description=$2
  local response own_uuid endpoint_uuid attempt

  for ((attempt = 1; attempt <= 60; attempt += 1)); do
    require_alive "$chrome_pid" "$description" || return 1
    if response=$(curl --fail --silent --max-time 2 "$cdp_base_url/json/version"); then
      require_alive "$chrome_pid" "$description" || return 1
      own_uuid=$(sed -nE 's|^DevTools listening on .*/devtools/browser/([[:xdigit:]-]{36})[[:space:]]*$|\1|p' "$log_file" | tail -n 1)
      endpoint_uuid=$(printf '%s\n' "$response" | sed -nE 's|.*"webSocketDebuggerUrl"[[:space:]]*:[[:space:]]*"[^"]*/devtools/browser/([[:xdigit:]-]{36})".*|\1|p')
      if [[ -n "$own_uuid" ]]; then
        if [[ "$endpoint_uuid" != "$own_uuid" ]]; then
          echo "$description CDP 身份不匹配，拒绝使用已有浏览器。" >&2
          return 1
        fi
        echo "$description 已就绪：$cdp_base_url"
        return 0
      fi
    fi
    sleep 1
  done
  echo "$description 启动超时：$cdp_base_url" >&2
  return 1
}

wait_for_dev_identity() {
  local headers token attempt
  # Cloudflare's dev asset worker applies server.headers to static resources;
  # the application Worker response does not necessarily inherit those headers.
  for ((attempt = 1; attempt <= 90; attempt += 1)); do
    require_alive "$dev_pid" "开发服务器" || return 1
    if headers=$(curl --head --fail --silent --max-time 2 "$dev_base_url/images/xmum-campus-map.jpg"); then
      require_alive "$dev_pid" "开发服务器" || return 1
      token=$(printf '%s\n' "$headers" | tr -d '\r' | awk 'tolower($1) == "x-xmum-browser-run:" { print $2 }')
      if [[ "$token" != "$run_token" ]]; then
        echo "开发服务器身份不匹配，拒绝使用已有站点。" >&2
        return 1
      fi
      wait_for_url "$dev_base_url/" "开发服务器" "$dev_pid" 90
      return $?
    fi
    sleep 1
  done
  echo "开发服务器身份检查超时：$dev_base_url" >&2
  return 1
}

stop_chrome() {
  if [[ -n "${chrome_pid:-}" ]] && kill -0 "$chrome_pid" 2>/dev/null; then
    kill "$chrome_pid" 2>/dev/null || true
    for _ in {1..10}; do
      if ! kill -0 "$chrome_pid" 2>/dev/null; then
        break
      fi
      sleep 1
    done
    kill -9 "$chrome_pid" 2>/dev/null || true
  fi
  if [[ -n "${chrome_pid:-}" ]]; then
    wait "$chrome_pid" 2>/dev/null || true
  fi
  chrome_pid=

  if [[ -n "${chrome_profile:-}" ]]; then
    rm -rf "$chrome_profile"
    chrome_profile=
  fi
}

start_chrome() {
  stop_chrome
  local label=$1
  require_unused_url "$cdp_base_url/json/version" "Chromium" || return 1
  local log_file="$startup_log_directory/chromium-$label.log"
  chrome_profile="$chrome_profile_root/$label"
  rm -rf "$chrome_profile"
  mkdir -p "$chrome_profile"
  "$chromium_path" \
    --headless=new \
    --no-sandbox \
    --remote-debugging-port="${cdp_base_url##*:}" \
    --user-data-dir="$chrome_profile" \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    about:blank \
    >"$log_file" 2>&1 &
  chrome_pid=$!
  wait_for_chrome "$log_file" "Chromium（${label}）"
}

start_dev_server() {
  echo "=== dev-server ==="
  require_unused_url "$dev_base_url/" "开发服务器" || return 1
  XMUM_BROWSER_RUN_TOKEN="$run_token" npm run dev -- \
    --port "${dev_base_url##*:}" --strictPort --host 127.0.0.1 \
    >"$startup_log_directory/dev-server.log" 2>&1 &
  dev_pid=$!
  wait_for_dev_identity
}

stop_dev_server() {
  if [[ -n "${dev_pid:-}" ]] && kill -0 "$dev_pid" 2>/dev/null; then
    kill "$dev_pid" 2>/dev/null || true
    for _ in {1..10}; do
      if ! kill -0 "$dev_pid" 2>/dev/null; then
        break
      fi
      sleep 1
    done
    kill -9 "$dev_pid" 2>/dev/null || true
  fi
  if [[ -n "${dev_pid:-}" ]]; then
    wait "$dev_pid" 2>/dev/null || true
  fi
  dev_pid=
}

cleanup() {
  local status=$?
  set +e
  stop_chrome
  stop_dev_server
  if [[ -n "$run_directory" ]]; then
    if [[ -d "$startup_log_directory" ]]; then
      mkdir -p "$artifact_run_directory/startup"
      cp -R "$startup_log_directory/." "$artifact_run_directory/startup/"
    fi
    rm -rf "$run_directory"
  fi
  exit "$status"
}

trap cleanup EXIT

mkdir -p "$artifact_directory" "$scratch_parent"
artifact_directory=$(cd "$artifact_directory" && pwd -P)
scratch_parent=$(cd "$scratch_parent" && pwd -P)
if [[ "$artifact_directory" == "$scratch_parent" ]]; then
  echo "BROWSER_ARTIFACT_DIR 与 BROWSER_FIXTURE_DIR 必须是不同目录。" >&2
  exit 2
fi
run_directory=$(mktemp -d "${scratch_parent%/}/xmum-browser-run.XXXXXX")
artifact_run_directory="$artifact_directory/${run_directory##*/}"
run_directory_real=$(cd "$run_directory" && pwd -P)
case "$artifact_run_directory/" in
  "$run_directory_real/"*)
    echo "artifact 目录不能位于本次 scratch 运行目录内。" >&2
    exit 2
    ;;
esac
case "$run_directory_real/" in
  "$artifact_run_directory/"*)
    echo "scratch 运行目录不能位于本次 artifact 目录内。" >&2
    exit 2
    ;;
esac
fixture_directory="$run_directory/fixtures"
chrome_profile_root="$run_directory/chrome"
startup_log_directory="$run_directory/logs"
run_token="${run_directory##*/}-$$"
mkdir -p "$fixture_directory" "$chrome_profile_root" "$startup_log_directory" "$artifact_run_directory"

if [[ -z "$chromium_path" ]]; then
  chromium_path=$(python3 - <<'PY'
from playwright.sync_api import sync_playwright

with sync_playwright() as playwright:
    print(playwright.chromium.executable_path)
PY
  )
fi

require_unused_url "$dev_base_url/" "开发服务器"
start_chrome node
run_logged single-browser env \
  CDP_URL="$cdp_base_url" \
  SINGLE_BROWSER_ARTIFACT_DIR="$artifact_run_directory/single-browser" \
  npm run test:single-browser
stop_chrome

start_dev_server

run_logged create-passport-fixture \
  node tests/create-passport-fixture.mjs \
  "$fixture_directory/passport-compressor-fixture.pdf"
run_logged create-passport-impossible-fixture \
  node tests/create-passport-fixture.mjs \
  "$fixture_directory/passport-compressor-impossible.pdf" --oversized-profile
run_logged create-health-fixture \
  node tests/create-health-form-fixture.mjs \
  "$fixture_directory/health-form-compressor-fixture.pdf"
run_logged create-health-impossible-fixture \
  node tests/create-health-form-fixture.mjs \
  "$fixture_directory/health-form-compressor-impossible.pdf" --impossible
run_logged create-adversarial-fixtures \
  node tests/create-adversarial-pdf-fixtures.mjs \
  "$fixture_directory/adversarial"

start_chrome passport
run_logged passport-browser env \
  CDP_URL="$cdp_base_url" \
  PASSPORT_TEST_URL="$dev_base_url" \
  PASSPORT_TEST_SCREENSHOT="$artifact_run_directory/passport-compressor-browser.png" \
  PASSPORT_TEST_OUTPUT="$artifact_run_directory/passport-compressor-browser-output.pdf" \
  python3 tests/passport-compressor-browser.py \
  "$fixture_directory/passport-compressor-fixture.pdf" \
  "$fixture_directory/passport-compressor-impossible.pdf"
stop_chrome

start_chrome health
run_logged health-browser env \
  CDP_URL="$cdp_base_url" \
  HEALTH_TEST_URL="$dev_base_url" \
  HEALTH_TEST_SCREENSHOT="$artifact_run_directory/health-compressor-browser.png" \
  HEALTH_TEST_OUTPUT="$artifact_run_directory/health-compressor-browser-output.pdf" \
  python3 tests/health-compressor-browser.py \
  "$fixture_directory/health-form-compressor-fixture.pdf" \
  "$fixture_directory/health-form-compressor-impossible.pdf"
stop_chrome

start_chrome adversarial
run_logged adversarial-browser env \
  CDP_URL="$cdp_base_url" \
  PDF_ADVERSARIAL_TEST_URL="$dev_base_url" \
  python3 tests/adversarial-pdf-browser.py \
  "$fixture_directory/adversarial" \
  "$fixture_directory/passport-compressor-fixture.pdf"
stop_chrome

echo "浏览器回归全部通过。失败时的日志、截图和成品 PDF 位于：$artifact_directory"
