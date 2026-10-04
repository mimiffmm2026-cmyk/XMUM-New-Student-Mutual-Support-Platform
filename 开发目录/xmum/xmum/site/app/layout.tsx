import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "厦大马校（XMUM）2026级新生互助导航｜非学校官网",
  description: "面向厦门大学马来西亚分校（XMUM）2026级新生与家长的公开互助导航；非学校官网，正式办理以本人当前系统与最新正式通知为准。",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "厦大马校（XMUM）2026级新生互助导航｜非学校官网",
    description: "2026级新生互助导航；正式办理以本人当前系统与最新正式通知为准。",
    url: "https://xmum-new-student-guide.ykzss7qp2d.chatgpt.site",
    siteName: "厦大马校（XMUM）2026级新生互助导航（非学校官网）",
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "厦大马校（XMUM）2026级新生互助导航｜非学校官网",
    description: "2026级新生互助导航；正式办理以本人当前系统与最新正式通知为准。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
