import os
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright


fixture_directory = Path(
    sys.argv[1] if len(sys.argv) > 1 else "/private/tmp/xmum-adversarial-pdfs"
).resolve()
cancel_fixture = Path(
    sys.argv[2] if len(sys.argv) > 2 else "/private/tmp/passport-compressor-fixture.pdf"
).resolve()
base_url = os.environ.get("PDF_ADVERSARIAL_TEST_URL", "http://localhost:4173")
cdp_url = os.environ.get("CDP_URL", "http://127.0.0.1:9344")

expected = {
    "passport": {
        "passport-cropbox-media-content.pdf": "CropBox 与 MediaBox 不一致",
        "passport-page-limit.pdf": "安全上限 40 页",
        "empty.pdf": "文件为空",
        "oversize-input.pdf": "本机安全上限",
    },
    "health": {
        "health-cropbox-media-content.pdf": "CropBox 与 MediaBox 不一致",
        "health-acroform-widget.pdf": "交互式表单",
        "health-page-annotation.pdf": "页面批注",
        "health-digital-signature-field.pdf": "数字签名字段",
        "health-page-limit.pdf": "安全上限 24 页",
        "health-pixel-limit.pdf": "尺寸异常",
        "empty.pdf": "文件为空",
        "oversize-input.pdf": "本机安全上限",
    },
}

for group in expected.values():
    for fixture_name in group:
        fixture_path = fixture_directory / fixture_name
        if not fixture_path.is_file():
            raise SystemExit(f"fixture not found: {fixture_path}")


def exercise_rejections(page, section_selector, group_name, button_pattern):
    section = page.locator(section_selector)
    files = [
        str(fixture_directory / fixture_name)
        for fixture_name in expected[group_name]
    ]
    file_input = section.locator('input[type="file"]')
    for fixture_path in files:
        file_input.set_input_files(fixture_path)
    start = section.get_by_role("button", name=re.compile(button_pattern))
    if start.is_enabled():
        start.click()

    row_selector = ".health-file" if group_name == "health" else ".passport-file"
    page.wait_for_function(
        """({ sectionSelector, rowSelector, expectedCount }) => {
          const section = document.querySelector(sectionSelector);
          const rows = [...section.querySelectorAll(rowSelector)];
          return rows.length === expectedCount && rows.every((row) =>
            row.classList.contains("passport-file-error")
          );
        }""",
        arg={
            "sectionSelector": section_selector,
            "rowSelector": row_selector,
            "expectedCount": len(files),
        },
        timeout=240_000,
    )

    for fixture_name, required_text in expected[group_name].items():
        row = section.locator(row_selector).filter(has_text=fixture_name)
        if row.count() != 1:
            raise AssertionError(f"missing unique row for {fixture_name}")
        text = row.inner_text()
        if required_text not in text:
            raise AssertionError(
                f"{fixture_name} did not report {required_text!r}: {text}"
            )
        if row.locator("a[download]").count() != 0:
            raise AssertionError(f"{fixture_name} exposed a download link")

    if not start.is_disabled():
        raise AssertionError(
            f"{group_name} start button should exclude terminal error rows"
        )


def exercise_cancellation(page):
    if not cancel_fixture.is_file():
        raise AssertionError(f"cancellation fixture not found: {cancel_fixture}")
    section = page.locator("#passport-compressor")
    section.get_by_role("button", name="清空").click()
    section.locator('input[type="file"]').set_input_files(str(cancel_fixture))
    section.get_by_role("button", name=re.compile(r"开始压缩并核验")).click()
    cancel = section.get_by_role("button", name="停止当前处理")
    cancel.wait_for(state="visible", timeout=10_000)
    cancel.click()
    row = section.locator(".passport-file")
    page.wait_for_function(
        """() => document.querySelector(
          "#passport-compressor .passport-file-error"
        )?.textContent.includes("已取消处理") === true""",
        timeout=30_000,
    )
    if row.locator("a[download]").count() != 0:
        raise AssertionError("cancelled compression exposed a download link")


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
        exercise_rejections(
            page,
            "#passport-compressor",
            "passport",
            r"开始压缩并核验",
        )
        exercise_rejections(
            page,
            "#health-compressor",
            "health",
            r"开始压缩到 500 KB 以下",
        )
        exercise_cancellation(page)
        if console_errors:
            raise AssertionError(f"browser console errors: {console_errors}")
        print(
            {
                "passport_rejections": len(expected["passport"]),
                "health_rejections": len(expected["health"]),
                "downloads_exposed": 0,
                "cancellation_without_download": True,
                "status": "passed",
            }
        )
    finally:
        page.close()
        browser.close()
