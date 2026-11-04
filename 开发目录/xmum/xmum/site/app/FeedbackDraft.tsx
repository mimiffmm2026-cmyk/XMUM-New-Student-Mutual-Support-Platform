"use client";

import { useRef, useState } from "react";
import { buildFeedbackDraft } from "./feedback-draft";

export default function FeedbackDraft({ reviewedAt }: { reviewedAt: string }) {
  const [type, setType] = useState("纠错");
  const [message, setMessage] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const copyRequest = useRef(0);
  const draft = buildFeedbackDraft({
    type,
    message,
    pageTitle: "知识资料索引",
    reviewedAt,
  });

  async function copyDraft() {
    const request = ++copyRequest.current;
    setCopyStatus("");
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(draft);
      if (request !== copyRequest.current) return;
      setCopyStatus("草稿已复制，尚未提交。请自行检查后交给资料维护者。");
    } catch {
      if (request !== copyRequest.current) return;
      setCopyStatus("自动复制失败，请选中下方草稿手动复制。草稿尚未提交。");
      const preview = document.getElementById("feedback-preview");
      if (preview instanceof HTMLTextAreaElement) {
        preview.focus();
        preview.select();
      }
    }
  }

  return (
    <details className="feedback-draft">
      <summary>本地反馈草稿 · 纠错或补充</summary>
      <div className="feedback-draft-body">
        <p id="feedback-boundary">
          内容只在本页生成，不会自动提交，也不会保存到服务器。请勿填写姓名、证件号、账号或个人联系方式；关闭或刷新本页会清空输入。
        </p>
        <label>
          <span>反馈类型</span>
          <select
            value={type}
            onChange={(event) => {
              copyRequest.current += 1;
              setType(event.target.value);
              setCopyStatus("");
            }}
          >
            <option>纠错</option>
            <option>补充</option>
            <option>问题</option>
          </select>
        </label>
        <label>
          <span>反馈内容</span>
          <textarea
            aria-describedby="feedback-boundary"
            rows={4}
            maxLength={3000}
            value={message}
            onChange={(event) => {
              copyRequest.current += 1;
              setMessage(event.target.value);
              setCopyStatus("");
            }}
            placeholder="例如：条目名称、需要纠正的文字、依据的通知日期。"
          />
        </label>
        <label>
          <span>反馈草稿（尚未提交）</span>
          <textarea id="feedback-preview" rows={7} readOnly value={draft} />
        </label>
        <button className="button button-primary" type="button" disabled={!draft} onClick={copyDraft}>
          复制反馈草稿
        </button>
        <p className="feedback-copy-status" role="status">{copyStatus}</p>
      </div>
    </details>
  );
}
