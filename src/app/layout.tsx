import type { Metadata } from "next";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "中国公司作息地图 | WorkLifeMap China",
  description:
    "基于上传的 955/965/996 公司作息数据生成可交互的中国城市级公司作息地图。支持 Excel 导入、自动分类、工作强度评级、搜索筛选与多格式导出。",
  keywords: [
    "公司作息地图", "955", "965", "996", "大小周", "单休",
    "WorkLifeMap", "China", "work schedule", "company map",
  ],
  authors: [{ name: "WorkLifeMap China" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "中国公司作息地图",
    description: "上传公司作息 Excel, 自动生成城市级工作强度地图",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground min-h-screen">
        {children}
        <SonnerToaster position="top-center" richColors />
      </body>
    </html>
  );
}
