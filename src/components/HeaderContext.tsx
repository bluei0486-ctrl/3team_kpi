"use client";

import React, { createContext, useContext, useState } from "react";

interface HeaderContextType {
  referenceDate: string;
  setReferenceDate: (date: string) => void;
  availableMonths: string[];
  setAvailableMonths: (months: string[]) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: React.ReactNode }) {
  const [referenceDate, setReferenceDate] = useState("2026년 5월 19일");
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  return (
    <HeaderContext.Provider
      value={{
        referenceDate,
        setReferenceDate,
        availableMonths,
        setAvailableMonths,
        selectedMonth,
        setSelectedMonth,
      }}
    >
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error("useHeader must be used within a HeaderProvider");
  }
  return context;
}
