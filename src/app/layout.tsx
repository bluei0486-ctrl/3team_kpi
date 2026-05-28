import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { HeaderProvider } from "@/components/HeaderContext";

export const metadata: Metadata = {
  title: "3팀 영업 실적 및 매출 지표 종합 분석 시스템",
  description: "3팀 영업 실적 자동화 및 데이터 시각화 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <HeaderProvider>
          <div className="app-container">
            <Sidebar />
            <div className="main-wrapper">
              <Header />
              <main className="page-content">{children}</main>
            </div>
          </div>
        </HeaderProvider>
      </body>
    </html>
  );
}
