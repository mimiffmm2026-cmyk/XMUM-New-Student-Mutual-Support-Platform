#!/usr/bin/env bash
set -euo pipefail

runner_temp=${RUNNER_TEMP:-${TMPDIR:-/tmp}}
artifact_directory=${BROWSER_ARTIFACT_DIR:-"$runner_temp/browser-artifacts"}
fixture_directory=${BROWSER_FIXTURE_DIR:-"$runner_temp/xmum-browser-fixtures"}
chrome_profile_root="$runner_temp/xmum-browser-chrome"
cdp_base_url=${CDP_URL:-http://127.0.0.1:9344}
dev_base_url=${BROWSER_DEV_URL:-http://127.0.0.1:4173}
chromium_path=${CHROMIUM_PATH:-}
chrome_pid=
chrome_profile=
dev_pid=

mkdir -p "$artifact_directory" "$fixture_directory" "$chrome_profile_root"

if [[ -z "$chromium_path" ]]; then
  chromium_path=$(python - <<'PY'
from playwright.sync_api import sync_playwright

with sync_playwright() as playwright:
    print(playwright.chromium.executable_path)
PY
  )
fi

run_logged() {
  local name=$1
  shift
  local log_file="$artifact_directory/$name.log"

  echo "=== $name ==="
  set +e
  "$@" 2>&1 | tee "$log_file"
  local command_status=${PIPESTATUS[0]}
  set -e
  return "$command_status"
}

wait_for_url() {
  local url=$1
  local description=$2
  local attempts=${3:-60}

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if curl --fail --silent --show-error --max-time 2 "$url" >/dev/null; then
      echo "$description 已就绪：$url"
      return 0
    fi
    sleep 1
  done

  echo "$description 启动超时：$url" >&2
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
    >"$artifact_directory/chromium-$label.log" 2>&1 &
  chrome_pid=$!
  wait_for_url "$cdp_base_url/json/version" "Chromium（${label}）" 60
}

start_dev_server() {
  echo "=== dev-server ==="
  npm run dev -- --port "${dev_base_url##*:}" --host 127.0.0.1 \
    >"$artifact_directory/dev-server.log" 2>&1 &
  dev_pid=$!
  wait_for_url "$dev_base_url/" "开发服务器" 90
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
  rm -rf "$fixture_directory" "$chrome_profile_root"
  exit "$status"
}

trap cleanup EXIT

start_chrome node
run_logged single-browser env \
  CDP_URL="$cdp_base_url" \
  SINGLE_BROWSER_ARTIFACT_DIR="$artifact_directory/single-browser" \
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
  PASSPORT_TEST_SCREENSHOT="$artifact_directory/passport-compressor-browser.png" \
  PASSPORT_TEST_OUTPUT="$artifact_directory/passport-compressor-browser-output.pdf" \
  python tests/passport-compressor-browser.py \
  "$fixture_directory/passport-compressor-fixture.pdf" \
  "$fixture_directory/passport-compressor-impossible.pdf"
stop_chrome

start_chrome health
run_logged health-browser env \
  CDP_URL="$cdp_base_url" \
  HEALTH_TEST_URL="$dev_base_url" \
  HEALTH_TEST_SCREENSHOT="$artifact_directory/health-compressor-browser.png" \
  HEALTH_TEST_OUTPUT="$artifact_directory/health-compressor-browser-output.pdf" \
  python tests/health-compressor-browser.py \
  "$fixture_directory/health-form-compressor-fixture.pdf" \
  "$fixture_directory/health-form-compressor-impossible.pdf"
stop_chrome

start_chrome adversarial
run_logged adversarial-browser env \
  CDP_URL="$cdp_base_url" \
  PDF_ADVERSARIAL_TEST_URL="$dev_base_url" \
  python tests/adversarial-pdf-browser.py \
  "$fixture_directory/adversarial" \
  "$fixture_directory/passport-compressor-fixture.pdf"
stop_chrome

echo "浏览器回归全部通过。失败时的日志、截图和成品 PDF 位于：$artifact_directory"
