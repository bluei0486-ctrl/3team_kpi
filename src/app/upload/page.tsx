"use client";

import { useState, useRef } from "react";
import { uploadExcelData } from "@/app/actions/upload";
import { useRouter } from "next/navigation";
type UploadStatus = "idle" | "uploading" | "success" | "error";

interface FileState {
  file: File | null;
  status: UploadStatus;
  message?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [dailyFile, setDailyFile] = useState<FileState>({ file: null, status: "idle" });
  const [monthlyFile, setMonthlyFile] = useState<FileState>({ file: null, status: "idle" });
  const [advertiserFile, setAdvertiserFile] = useState<FileState>({ file: null, status: "idle" });
  const [globalStatus, setGlobalStatus] = useState<UploadStatus>("idle");
  const [globalMessage, setGlobalMessage] = useState("");

  // Refs for hidden file inputs
  const dailyInputRef = useRef<HTMLInputElement>(null);
  const monthlyInputRef = useRef<HTMLInputElement>(null);
  const advertiserInputRef = useRef<HTMLInputElement>(null);

  // Drag states
  const [dailyDrag, setDailyDrag] = useState(false);
  const [monthlyDrag, setMonthlyDrag] = useState(false);
  const [advertiserDrag, setAdvertiserDrag] = useState(false);

  const handleFileChange = (
    type: "daily" | "monthly" | "advertiser",
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] || null;
    if (type === "daily") {
      setDailyFile({ file, status: "idle" });
    } else if (type === "monthly") {
      setMonthlyFile({ file, status: "idle" });
    } else {
      setAdvertiserFile({ file, status: "idle" });
    }
  };

  // Drag and drop event handlers
  const handleDragOver = (type: "daily" | "monthly" | "advertiser", e: React.DragEvent) => {
    e.preventDefault();
    if (type === "daily") setDailyDrag(true);
    else if (type === "monthly") setMonthlyDrag(true);
    else setAdvertiserDrag(true);
  };

  const handleDragLeave = (type: "daily" | "monthly" | "advertiser") => {
    if (type === "daily") setDailyDrag(false);
    else if (type === "monthly") setMonthlyDrag(false);
    else setAdvertiserDrag(false);
  };

  const handleDrop = (type: "daily" | "monthly" | "advertiser", e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0] || null;
    if (type === "daily") {
      setDailyDrag(false);
      setDailyFile({ file, status: "idle" });
    } else if (type === "monthly") {
      setMonthlyDrag(false);
      setMonthlyFile({ file, status: "idle" });
    } else {
      setAdvertiserDrag(false);
      setAdvertiserFile({ file, status: "idle" });
    }
  };

  const triggerFileInput = (type: "daily" | "monthly" | "advertiser") => {
    if (type === "daily") dailyInputRef.current?.click();
    else if (type === "monthly") monthlyInputRef.current?.click();
    else advertiserInputRef.current?.click();
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleUploadAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dailyFile.file || !monthlyFile.file || !advertiserFile.file) {
      const missing: string[] = [];
      if (!dailyFile.file) missing.push("1. 마케터별 일별 매출 데이터");
      if (!monthlyFile.file) missing.push("2. 마케터별 월간 매출 및 목표 데이터");
      if (!advertiserFile.file) missing.push("3. 광고주별 기간 매출 데이터");

      const missingText = missing.join("\n");
      alert(`누락된 파일이 있습니다. 다음 파일을 업로드해 주세요:\n\n${missingText}`);

      setGlobalStatus("error");
      setGlobalMessage(`누락된 파일이 있습니다. 다음 파일을 모두 업로드해 주세요: ${missing.map(m => m.substring(3)).join(", ")}`);
      return;
    }

    setGlobalStatus("uploading");
    setGlobalMessage("엑셀 파일을 서버에서 분석하고 Supabase DB에 적재하는 중입니다. (약 5~10초 소요)");
    setDailyFile(prev => ({ ...prev, status: "uploading" }));
    setMonthlyFile(prev => ({ ...prev, status: "uploading" }));
    setAdvertiserFile(prev => ({ ...prev, status: "uploading" }));

    try {
      const formData = new FormData();
      formData.append("dailyFile", dailyFile.file);
      formData.append("monthlyFile", monthlyFile.file);
      formData.append("advertiserFile", advertiserFile.file);

      const response = await uploadExcelData(formData);

      if (response.success) {
        setDailyFile(prev => ({ ...prev, status: "success" }));
        setMonthlyFile(prev => ({ ...prev, status: "success" }));
        setAdvertiserFile(prev => ({ ...prev, status: "success" }));
        setGlobalStatus("success");
        setGlobalMessage(response.message);
        
        // Refresh the page data router and return to dashboard
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 1500);
      } else {
        setDailyFile(prev => ({ ...prev, status: "error" }));
        setMonthlyFile(prev => ({ ...prev, status: "error" }));
        setAdvertiserFile(prev => ({ ...prev, status: "error" }));
        setGlobalStatus("error");
        setGlobalMessage(response.message || "데이터 저장 도중 에러가 발생했습니다.");
        if (response.message === "이미 등록된 데이터입니다") {
          alert("이미 등록된 데이터입니다");
        }
      }
    } catch (err: any) {
      setDailyFile(prev => ({ ...prev, status: "error" }));
      setMonthlyFile(prev => ({ ...prev, status: "error" }));
      setAdvertiserFile(prev => ({ ...prev, status: "error" }));
      setGlobalStatus("error");
      setGlobalMessage(err.message || "파일 업로드 처리 과정에 실패했습니다.");
    }
  };

  const getStatusBadge = (status: UploadStatus) => {
    switch (status) {
      case "idle":
        return <span className="status-badge status-pending">대기 중</span>;
      case "uploading":
        return <span className="status-badge status-pending">처리 중...</span>;
      case "success":
        return <span className="status-badge status-success">완료</span>;
      case "error":
        return <span className="status-badge status-error">실패</span>;
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "1.8rem", fontWeight: 700, marginBottom: "8px" }}>엑셀 데이터 업로드</h2>
        <p style={{ color: "var(--text-secondary)" }}>
          마케터별 일별매출, 월간매출 및 광고주 기간매출 엑셀 파일을 드래그 & 드롭하여 업로드하거나 영역을 클릭해 선택하세요.
        </p>
      </div>

      <form onSubmit={handleUploadAll}>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "32px" }}>
          
          {/* Daily Sales File Dropzone */}
          <div
            className={`upload-card-zone ${dailyDrag ? "dragover" : ""} ${dailyFile.file ? "has-file" : ""} ${
              dailyFile.status === "uploading" ? "uploading" : ""
            } ${dailyFile.status === "error" ? "error" : ""}`}
            onDragOver={(e) => handleDragOver("daily", e)}
            onDragLeave={() => handleDragLeave("daily")}
            onDrop={(e) => handleDrop("daily", e)}
            onClick={() => triggerFileInput("daily")}
          >
            <input
              type="file"
              ref={dailyInputRef}
              accept=".xls,.xlsx"
              onChange={(e) => handleFileChange("daily", e)}
              onClick={(e) => e.stopPropagation()}
              style={{ display: "none" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>1. 마케터별 일별 매출 데이터</h3>
              {getStatusBadge(dailyFile.status)}
            </div>
            
            {dailyFile.file ? (
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
                <span style={{ fontSize: "2rem" }}>📄</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)" }}>
                    {dailyFile.file.name}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {formatSize(dailyFile.file.size)}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "16px 0", display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
                <span style={{ fontSize: "2.5rem" }}>📥</span>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                  파일을 이 영역에 드래그하거나 <span className="file-select-trigger">여기를 클릭</span>하여 선택하세요.
                </p>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  파일명 예시: `마케터별 일별매출.xls` (마케터명, 매체명, 일별 매출액 포함)
                </p>
              </div>
            )}
          </div>

          {/* Monthly Sales File Dropzone */}
          <div
            className={`upload-card-zone ${monthlyDrag ? "dragover" : ""} ${monthlyFile.file ? "has-file" : ""} ${
              monthlyFile.status === "uploading" ? "uploading" : ""
            } ${monthlyFile.status === "error" ? "error" : ""}`}
            onDragOver={(e) => handleDragOver("monthly", e)}
            onDragLeave={() => handleDragLeave("monthly")}
            onDrop={(e) => handleDrop("monthly", e)}
            onClick={() => triggerFileInput("monthly")}
          >
            <input
              type="file"
              ref={monthlyInputRef}
              accept=".xls,.xlsx"
              onChange={(e) => handleFileChange("monthly", e)}
              onClick={(e) => e.stopPropagation()}
              style={{ display: "none" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>2. 마케터별 월간 매출 및 목표 데이터</h3>
              {getStatusBadge(monthlyFile.status)}
            </div>
            
            {monthlyFile.file ? (
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
                <span style={{ fontSize: "2rem" }}>📄</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)" }}>
                    {monthlyFile.file.name}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {formatSize(monthlyFile.file.size)}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "16px 0", display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
                <span style={{ fontSize: "2.5rem" }}>📥</span>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                  파일을 이 영역에 드래그하거나 <span className="file-select-trigger">여기를 클릭</span>하여 선택하세요.
                </p>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  파일명 예시: `마케터별 월간매출.xls` (마케터별 4-5월 목표, 매체별 실적, 라이브 계정 현황 포함)
                </p>
              </div>
            )}
          </div>

          {/* Advertiser Sales File Dropzone */}
          <div
            className={`upload-card-zone ${advertiserDrag ? "dragover" : ""} ${advertiserFile.file ? "has-file" : ""} ${
              advertiserFile.status === "uploading" ? "uploading" : ""
            } ${advertiserFile.status === "error" ? "error" : ""}`}
            onDragOver={(e) => handleDragOver("advertiser", e)}
            onDragLeave={() => handleDragLeave("advertiser")}
            onDrop={(e) => handleDrop("advertiser", e)}
            onClick={() => triggerFileInput("advertiser")}
          >
            <input
              type="file"
              ref={advertiserInputRef}
              accept=".xls,.xlsx"
              onChange={(e) => handleFileChange("advertiser", e)}
              onClick={(e) => e.stopPropagation()}
              style={{ display: "none" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>3. 광고주별 기간 매출 데이터</h3>
              {getStatusBadge(advertiserFile.status)}
            </div>
            
            {advertiserFile.file ? (
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
                <span style={{ fontSize: "2rem" }}>📄</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)" }}>
                    {advertiserFile.file.name}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {formatSize(advertiserFile.file.size)}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "16px 0", display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
                <span style={{ fontSize: "2.5rem" }}>📥</span>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                  파일을 이 영역에 드래그하거나 <span className="file-select-trigger">여기를 클릭</span>하여 선택하세요.
                </p>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  파일명 예시: `광고주 기간매출.xlsx` (광고주ID, 매체별 건수 및 공급가액 포함)
                </p>
              </div>
            )}
          </div>

        </div>

        {globalMessage && (
          <div
            className="card"
            style={{
              marginBottom: "24px",
              padding: "16px",
              backgroundColor:
                globalStatus === "success"
                  ? "var(--success-light)"
                  : globalStatus === "error"
                  ? "var(--danger-light)"
                  : "var(--warning-light)",
              border: `1px solid ${
                globalStatus === "success"
                  ? "var(--success)"
                  : globalStatus === "error"
                  ? "var(--danger)"
                  : "var(--warning)"
              }`,
              color:
                globalStatus === "success"
                  ? "var(--success)"
                  : globalStatus === "error"
                  ? "var(--danger)"
                  : "var(--warning)",
              fontWeight: 500,
            }}
          >
            {globalMessage}
          </div>
        )}

        <div style={{ textAlign: "center" }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={globalStatus === "uploading"}
            style={{ padding: "14px 40px", fontSize: "1rem", borderRadius: "var(--radius-md)" }}
          >
            {globalStatus === "uploading" ? "데이터 처리 중..." : "엑셀 데이터 분석 및 DB 동기화"}
          </button>
        </div>
      </form>
    </div>
  );
}
