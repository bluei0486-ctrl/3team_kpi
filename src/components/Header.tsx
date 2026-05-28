"use client";

import { useHeader } from "@/components/HeaderContext";

export default function Header() {
  const { referenceDate, availableMonths, selectedMonth, setSelectedMonth } = useHeader();

  return (
    <header className="main-header">
      <div className="header-title">3팀 영업 실적 분석 플랫폼</div>
      <div className="header-actions">
        {availableMonths && availableMonths.length > 0 && (
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              padding: "6px 12px",
              fontSize: "0.85rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-card)",
              color: "var(--text-primary)",
              fontWeight: 600,
              outline: "none",
              cursor: "pointer",
              boxShadow: "var(--shadow-sm)",
              transition: "border-color var(--transition-fast)",
            }}
          >
            {availableMonths.map((m) => {
              const [year, month] = m.split("-");
              return (
                <option key={m} value={m}>
                  {year}년 {parseInt(month)}월 실적
                </option>
              );
            })}
          </select>
        )}
        <div className="header-meta">기준일: {referenceDate} 누적 데이터</div>
      </div>
    </header>
  );
}
