export const WECHAT_DOWNLOAD_HINT =
  "微信内点击下载可能没有反应：请点右上角 ···，选择“在浏览器打开”，再回到本页重新下载。";

export function isWeChatUserAgent(userAgent: string): boolean {
  return /MicroMessenger/i.test(userAgent);
}
