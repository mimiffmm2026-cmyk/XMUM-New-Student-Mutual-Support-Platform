import assert from "node:assert/strict";
import test from "node:test";

import {
  WECHAT_DOWNLOAD_HINT,
  isWeChatUserAgent,
} from "../app/download-hint.ts";

test("wechat user agent detection only matches the WeChat webview", () => {
  assert.equal(
    isWeChatUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 MicroMessenger/8.0.49",
    ),
    true,
  );
  assert.equal(
    isWeChatUserAgent(
      "Mozilla/5.0 (Linux; Android 14; 23013RK75C Build/UKQ1) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36",
    ),
    false,
  );
  assert.equal(isWeChatUserAgent(""), false);
});

test("wechat download hint explains how to finish the download in a browser", () => {
  assert.match(WECHAT_DOWNLOAD_HINT, /微信/);
  assert.match(WECHAT_DOWNLOAD_HINT, /在浏览器打开/);
  assert.match(WECHAT_DOWNLOAD_HINT, /重新下载/);
});
