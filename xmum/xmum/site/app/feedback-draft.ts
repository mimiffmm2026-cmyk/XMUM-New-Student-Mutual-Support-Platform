export type FeedbackDraftInput = {
  type: string;
  message: string;
  pageTitle: string;
  reviewedAt: string;
};

export function buildFeedbackDraft({
  type,
  message,
  pageTitle,
  reviewedAt,
}: FeedbackDraftInput) {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return "";
  }

  return [
    "XMUM 新生互助导航·本地反馈草稿",
    `类型：${type}`,
    `页面：${pageTitle}`,
    `资料核对至：${reviewedAt}`,
    `内容：${trimmedMessage}`,
    "",
    "说明：本段文字只在本机生成和复制，不会自动提交到服务器。",
  ].join("\n");
}
