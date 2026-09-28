import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright


fixture = Path(
    sys.argv[1] if len(sys.argv) > 1 else "/private/tmp/health-form-compressor-fixture.pdf"
).resolve()
impossible_fixture = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else None
base_url = os.environ.get("HEALTH_TEST_URL", "http://localhost:4173")
cdp_url = os.environ.get("CDP_URL", "http://127.0.0.1:9344")
screenshot = Path(
    os.environ.get(
        "HEALTH_TEST_SCREENSHOT",
        "/private/tmp/health-compressor-browser.png",
    )
).resolve()
mobile_screenshot = screenshot.with_name(
    f"{screenshot.stem}-mobile{screenshot.suffix}"
)
output_pdf = Path(
    os.environ.get(
        "HEALTH_TEST_OUTPUT",
        "/private/tmp/health-compressor-browser-output.pdf",
    )
).resolve()


def poppler_page_info(pdf_path, page_number):
    result = subprocess.run(
        [
            "pdfinfo",
            "-f",
            str(page_number),
            "-l",
            str(page_number),
            "-box",
            str(pdf_path),
        ],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    values = {}
    for line in result.splitlines():
        match = re.match(
            r"Page(?:\s+\d+)?\s+(size|rot|MediaBox|CropBox):\s*(.+)",
            line,
        )
        if match:
            values[match.group(1)] = " ".join(match.group(2).split())
    return values


def verify_with_poppler(source_path, output_path, expected_pages):
    source_info = subprocess.run(
        ["pdfinfo", "-box", str(source_path)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    output_info = subprocess.run(
        ["pdfinfo", "-box", str(output_path)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    assert re.search(rf"^Pages:\s+{expected_pages}$", source_info, re.MULTILINE)
    assert re.search(rf"^Pages:\s+{expected_pages}$", output_info, re.MULTILINE)
    for page_number in range(1, expected_pages + 1):
        source_page = poppler_page_info(source_path, page_number)
        output_page = poppler_page_info(output_path, page_number)
        if source_page != output_page:
            raise AssertionError(
                f"Poppler geometry mismatch on page {page_number}: "
                f"{source_page} != {output_page}"
            )
    with tempfile.TemporaryDirectory(prefix="xmum-health-render-") as directory:
        prefix = str(Path(directory) / "page")
        subprocess.run(
            ["pdftoppm", "-png", "-r", "36", str(output_path), prefix],
            check=True,
            capture_output=True,
        )
        rendered = list(Path(directory).glob("page-*.png"))
        if len(rendered) != expected_pages or any(
            rendered_page.stat().st_size == 0 for rendered_page in rendered
        ):
            raise AssertionError("Poppler did not render every health form page")

if not fixture.is_file():
    raise SystemExit(f"fixture not found: {fixture}")
if fixture.stat().st_size < 500_000:
    raise SystemExit(f"fixture must be at least 500,000 bytes: {fixture.stat().st_size}")
if impossible_fixture and not impossible_fixture.is_file():
    raise SystemExit(f"impossible fixture not found: {impossible_fixture}")

original_size = fixture.stat().st_size

with sync_playwright() as playwright:
    browser = playwright.chromium.connect_over_cdp(cdp_url)
    context = browser.contexts[0]
    page = context.new_page()
    console_errors = []
    page.on(
        "console",
        lambda message: console_errors.append(message.text)
        if message.type == "error"
        and message.text
        != "Failed to load resource: the server responded with a status of 404 (Not Found)"
        else None,
    )

    try:
        page.goto(base_url, wait_until="networkidle", timeout=30_000)
        compressor = page.locator("#health-compressor")
        compressor.scroll_into_view_if_needed()
        selected_files = [str(fixture)]
        if impossible_fixture:
            selected_files.append(str(impossible_fixture))
        compressor.locator('input[type="file"]').set_input_files(selected_files)
        compressor.get_by_role(
            "button", name=re.compile(r"开始压缩到 500 KB 以下")
        ).click()
        page.wait_for_function(
            """(expected) => {
              const rows = [...document.querySelectorAll('.health-file')];
              return rows.length === expected && rows.every((row) =>
                row.classList.contains('passport-file-success') ||
                row.classList.contains('passport-file-error')
              );
            }""",
            arg=len(selected_files),
            timeout=240_000,
        )

        row = page.locator(".health-file").first
        if "passport-file-error" in (row.get_attribute("class") or ""):
            raise AssertionError(row.inner_text())

        download = row.locator("a[download]")
        if download.get_attribute("download") != fixture.name:
            raise AssertionError("compressed health form did not keep original filename")
        output_bytes = page.evaluate(
            """async () => {
              const link = document.querySelector('.health-file a[download]');
              if (!link) throw new Error('download link missing');
              return (await (await fetch(link.href)).arrayBuffer()).byteLength;
            }"""
        )
        if output_bytes >= 500_000:
            raise AssertionError(f"output is not below 500,000 bytes: {output_bytes}")
        with page.expect_download(timeout=30_000) as download_info:
            download.click()
        download_info.value.save_as(str(output_pdf))
        verify_with_poppler(fixture, output_pdf, 2)

        row_text = row.inner_text()
        for required in [
            "压缩前",
            "压缩后",
            "逐页核验",
            "小于 500 KB",
            "最低相似度",
            "局部分块",
            "高频边缘",
        ]:
            if required not in row_text:
                raise AssertionError(f"missing verification text: {required}")

        if fixture.stat().st_size != original_size:
            raise AssertionError("source fixture was modified")

        if impossible_fixture:
            impossible_row = page.locator(".health-file").nth(1)
            impossible_class = impossible_row.get_attribute("class") or ""
            if "passport-file-error" not in impossible_class:
                raise AssertionError("impossible fixture should stop without a product")
            if impossible_row.locator("a[download]").count() != 0:
                raise AssertionError("failed fixture exposed a download")

        page.screenshot(path=str(screenshot), full_page=False)
        page.set_viewport_size({"width": 390, "height": 844})
        compressor.scroll_into_view_if_needed()
        page.wait_for_timeout(250)
        has_horizontal_overflow = page.evaluate(
            "() => document.documentElement.scrollWidth > document.documentElement.clientWidth"
        )
        if has_horizontal_overflow:
            raise AssertionError("mobile layout has horizontal overflow")
        page.screenshot(path=str(mobile_screenshot), full_page=False)
        if console_errors:
            raise AssertionError(f"browser console errors: {console_errors}")

        print(
            {
                "fixture_bytes": original_size,
                "output_bytes": output_bytes,
                "poppler_pages_boxes_rotation_rendered": 2,
                "filename_preserved": True,
                "impossible_fixture_rejected": bool(impossible_fixture),
                "screenshot": str(screenshot),
                "mobile_screenshot": str(mobile_screenshot),
                "status": "passed",
            }
        )
    finally:
        page.close()
        browser.close()
