"use server";



import * as XLSX from "xlsx";
import { createClient } from "@/utils/supabase/server";
import { GoogleGenAI } from "@google/genai";

interface UploadResponse {
  success: boolean;
  message: string;
}

// Media Mapping Helper
function normalizeMediaName(name: string): string {
  if (!name) return "기타";
  const trimmed = name.trim();
  if (trimmed === "네이버" || trimmed === "네이버GFA") {
    return "네이버";
  }
  if (
    trimmed === "지마켓" ||
    trimmed === "지마켓글로벌" ||
    trimmed === "AI매출업" ||
    trimmed === "노출보장" ||
    trimmed === "지마켓AI매출업" ||
    trimmed === "지마켓노출보장"
  ) {
    return "지마켓";
  }
  return trimmed;
}

function getPrecedingYearMonth(year: number, month: number, monthsAgo: number): { year: number; month: number } {
  let targetMonth = month - monthsAgo;
  let targetYear = year;
  while (targetMonth <= 0) {
    targetMonth += 12;
    targetYear -= 1;
  }
  return { year: targetYear, month: targetMonth };
}

function getRowValueByPattern(row: any, monthNum: number, suffixes: string[]): number | undefined {
  const keys = Object.keys(row);
  for (const suffix of suffixes) {
    const regex = new RegExp(`^\\s*${monthNum}\\s*월\\s*${suffix}\\s*$`);
    const matchingKey = keys.find(k => regex.test(k));
    if (matchingKey !== undefined) {
      return Number(row[matchingKey] || 0);
    }
  }
  return undefined;
}

export async function uploadExcelData(formData: FormData): Promise<UploadResponse> {
  try {
    const dailyFile = formData.get("dailyFile") as File;
    const monthlyFile = formData.get("monthlyFile") as File;
    const advertiserFile = formData.get("advertiserFile") as File;

    if (!dailyFile || !monthlyFile || !advertiserFile) {
      return { success: false, message: "세 개의 파일이 모두 업로드되지 않았습니다." };
    }

    // 1. Read files into array buffers
    const dailyBuffer = Buffer.from(await dailyFile.arrayBuffer());
    const monthlyBuffer = Buffer.from(await monthlyFile.arrayBuffer());
    const advertiserBuffer = Buffer.from(await advertiserFile.arrayBuffer());

    // 2. Parse workbooks
    const dailyWb = XLSX.read(dailyBuffer, { type: "buffer" });
    const monthlyWb = XLSX.read(monthlyBuffer, { type: "buffer" });
    const advertiserWb = XLSX.read(advertiserBuffer, { type: "buffer" });

    // 3. Convert sheets to JSON objects
    const dailySheet = dailyWb.Sheets[dailyWb.SheetNames[0]];
    const dailyData = XLSX.utils.sheet_to_json<any>(dailySheet);

    const monthlySheet = monthlyWb.Sheets[monthlyWb.SheetNames[0]];
    const monthlyDataRaw = XLSX.utils.sheet_to_json<any>(monthlySheet);
    const monthlyData = monthlyDataRaw.filter((row: any) => {
      const media = row["매체명"] || "";
      return !media.startsWith("합계");
    });

    const advertiserSheet = advertiserWb.Sheets[advertiserWb.SheetNames[0]];
    const advertiserData = XLSX.utils.sheet_to_json<any>(advertiserSheet);

    const supabase = await createClient();

    // 3.5 Check date criteria and duplicates
    let maxDateInFile: string | null = null;
    const datesInFile: string[] = [];
    dailyData.forEach((row) => {
      const salesDateRaw = row["매출일"];
      let salesDate: string | null = null;
      if (salesDateRaw) {
        if (typeof salesDateRaw === "number") {
          const dateObj = XLSX.SSF.parse_date_code(salesDateRaw);
          salesDate = `${dateObj.y}-${String(dateObj.m).padStart(2, "0")}-${String(dateObj.d).padStart(2, "0")}`;
        } else {
          salesDate = String(salesDateRaw).trim().substring(0, 10);
        }
        datesInFile.push(salesDate);
      }
    });

    if (datesInFile.length > 0) {
      maxDateInFile = datesInFile.reduce((max, cur) => (cur > max ? cur : max), datesInFile[0]);
    }

    if (maxDateInFile) {
      const { data: existingSales, error: existingSalesError } = await supabase
        .from("daily_sales")
        .select("sales_date")
        .eq("sales_date", maxDateInFile)
        .limit(1);

      if (!existingSalesError && existingSales && existingSales.length > 0) {
        // If the exact max date from the file is already in the database, block the upload.
        return { success: false, message: "이미 등록된 데이터입니다" };
      }

    }

    // 4. Upsert Media
    const uniqueMediaNames = new Set<string>();
    dailyData.forEach((row) => {
      if (row["매체명"]) uniqueMediaNames.add(normalizeMediaName(row["매체명"]));
    });
    monthlyData.forEach((row) => {
      if (row["매체명"]) uniqueMediaNames.add(normalizeMediaName(row["매체명"]));
    });
    advertiserData.forEach((row) => {
      if (row["매체명"]) uniqueMediaNames.add(normalizeMediaName(row["매체명"]));
    });

    const mediaList = Array.from(uniqueMediaNames).map((name) => ({ name }));
    const { data: insertedMedia, error: mediaError } = await supabase
      .from("media")
      .upsert(mediaList, { onConflict: "name" })
      .select();

    if (mediaError) throw new Error(`Media upsert error: ${mediaError.message}`);

    const mediaMap = new Map<string, string>();
    insertedMedia?.forEach((m) => mediaMap.set(m.name, m.id));

    // 5. Upsert Marketers
    const marketerMap = new Map<string, { name: string; hire_date?: string }>();
    
    // Read from monthly sales sheet (gives hire_date and ids)
    monthlyData.forEach((row) => {
      const name = row["직원명"];
      if (name) {
        let hireDate: string | undefined = undefined;
        if (row["입사일"]) {
          if (typeof row["입사일"] === "number") {
            const dateObj = XLSX.SSF.parse_date_code(row["입사일"]);
            hireDate = `${dateObj.y}-${String(dateObj.m).padStart(2, "0")}-${String(dateObj.d).padStart(2, "0")}`;
          } else {
            hireDate = String(row["입사일"]).trim().substring(0, 10);
          }
        }
        marketerMap.set(name, { name, hire_date: hireDate });
      }
    });

    // Also look at advertiser mapping sheet to get employee codes
    const marketerCodeMap = new Map<string, string>(); // marketer name -> employee code
    advertiserData.forEach((row) => {
      const name = row["마케터명"] || row["직원명"];
      const code = row["마케터ID"];
      if (name && code) {
        marketerCodeMap.set(name, code);
      }
    });

    const marketerUpsertList = Array.from(marketerMap.values()).map((m) => ({
      name: m.name,
      employee_code: marketerCodeMap.get(m.name) || null,
      hire_date: m.hire_date || null,
      department: "3팀",
    }));

    const { data: insertedMarketers, error: marketerError } = await supabase
      .from("marketers")
      .upsert(marketerUpsertList, { onConflict: "employee_code" })
      .select();

    if (marketerError) throw new Error(`Marketer upsert error: ${marketerError.message}`);

    const dbMarketerMap = new Map<string, string>(); // marketer name -> uuid
    insertedMarketers?.forEach((m) => dbMarketerMap.set(m.name, m.id));

    // 6. Upsert Advertisers
    const advertiserUpsertMap = new Map<string, any>();
    advertiserData.forEach((row) => {
      const mpId = row["엠피광고주ID"];
      const mpName = row["엠피광고주명"];
      const advId = row["광고주ID"];
      const advName = row["광고주명"];
      const marketerName = row["마케터명"] || row["직원명"];

      if (mpId && advName) {
        advertiserUpsertMap.set(mpId, {
          mp_advertiser_id: mpId,
          mp_advertiser_name: mpName || null,
          advertiser_code: advId || null,
          name: advName,
          marketer_id: marketerName ? dbMarketerMap.get(marketerName) || null : null,
        });
      }
    });

    const advertiserList = Array.from(advertiserUpsertMap.values());
    const { data: insertedAdvertisers, error: advertiserError } = await supabase
      .from("advertisers")
      .upsert(advertiserList, { onConflict: "mp_advertiser_id" })
      .select();

    if (advertiserError) throw new Error(`Advertiser upsert error: ${advertiserError.message}`);

    const dbAdvertiserMap = new Map<string, string>(); // mp_advertiser_id -> uuid
    insertedAdvertisers?.forEach((a) => dbAdvertiserMap.set(a.mp_advertiser_id, a.id));

    // 7. Upsert Daily Sales
    const dailySalesList: any[] = [];
    dailyData.forEach((row) => {
      const mName = row["직원명"];
      const mediaRaw = row["매체명"];
      const salesDateRaw = row["매출일"];
      const amount = Number(row["매출액"] || 0);

      const mId = mName ? dbMarketerMap.get(mName) : null;
      const mediaNormalized = normalizeMediaName(mediaRaw);
      const mediaId = mediaMap.get(mediaNormalized);

      let salesDate: string | null = null;
      if (salesDateRaw) {
        if (typeof salesDateRaw === "number") {
          const dateObj = XLSX.SSF.parse_date_code(salesDateRaw);
          salesDate = `${dateObj.y}-${String(dateObj.m).padStart(2, "0")}-${String(dateObj.d).padStart(2, "0")}`;
        } else {
          salesDate = String(salesDateRaw).trim().substring(0, 10);
        }
      }

      if (mId && mediaId && salesDate) {
        dailySalesList.push({
          marketer_id: mId,
          media_id: mediaId,
          sales_date: salesDate,
          amount,
        });
      }
    });

    // Aggregate duplicate keys in dailySalesList to prevent:
    // "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const aggregatedDailySales = new Map<string, any>();
    dailySalesList.forEach((item) => {
      const key = `${item.marketer_id}_${item.media_id}_${item.sales_date}`;
      if (aggregatedDailySales.has(key)) {
        const existing = aggregatedDailySales.get(key);
        existing.amount += item.amount;
      } else {
        aggregatedDailySales.set(key, { ...item });
      }
    });
    const finalDailySalesList = Array.from(aggregatedDailySales.values());

    // Bulk upsert in chunks to avoid payload size limit
    const chunkArray = (arr: any[], size: number) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
      );

    const dailySalesChunks = chunkArray(finalDailySalesList, 200);
    for (const chunk of dailySalesChunks) {
      const { error: dailyErr } = await supabase
        .from("daily_sales")
        .upsert(chunk, { onConflict: "marketer_id,media_id,sales_date" });
      if (dailyErr) throw new Error(`Daily sales upsert error: ${dailyErr.message}`);
    }

        // 8. Upsert Monthly Sales Targets & History
    let activeYear = new Date().getFullYear();
    if (maxDateInFile) {
      activeYear = new Date(maxDateInFile).getFullYear();
    }

    let activeMonthNum = 5; // Default fallback
    if (monthlyData.length > 0) {
      const keys = Object.keys(monthlyData[0]);
      for (const key of keys) {
        const match = key.match(/^(\d+)월\s*목표/);
        if (match) {
          activeMonthNum = parseInt(match[1], 10);
          break;
        }
      }
    }

    const monthlyTargetsList: any[] = [];
    monthlyData.forEach((row) => {
      const mName = row["직원명"];
      const mediaRaw = row["매체명"];

      const mId = mName ? dbMarketerMap.get(mName) : null;
      const mediaNormalized = normalizeMediaName(mediaRaw);
      const mediaId = mediaMap.get(mediaNormalized);

      if (mId && mediaId) {
        for (let i = 0; i <= 4; i++) {
          const targetDateObj = getPrecedingYearMonth(activeYear, activeMonthNum, i);
          const targetDateStr = `${targetDateObj.year}-${String(targetDateObj.month).padStart(2, "0")}-01`;

          let targetAmountRaw: number | undefined;
          let newAccountsRaw: number | undefined;
          let transInRaw: number | undefined;
          let transOutRaw: number | undefined;
          let liveAccountsRaw: number | undefined;
          let actualSalesRaw: number | undefined;

          if (i === 0) {
            targetAmountRaw = getRowValueByPattern(row, targetDateObj.month, ["목표"]);
            newAccountsRaw = getRowValueByPattern(row, targetDateObj.month, ["신규"]);
            transInRaw = getRowValueByPattern(row, targetDateObj.month, ["이관"]);
            transOutRaw = getRowValueByPattern(row, targetDateObj.month, ["피이관", "이탈"]);
            liveAccountsRaw = getRowValueByPattern(row, targetDateObj.month, ["라이브"]);
            actualSalesRaw = getRowValueByPattern(row, targetDateObj.month, ["누적", "매출액", "매출"]);
          } else {
            targetAmountRaw = getRowValueByPattern(row, targetDateObj.month, ["목표"]);
            actualSalesRaw = getRowValueByPattern(row, targetDateObj.month, ["누적", "매출액", "매출"]);
          }

          // If this month doesn't have any relevant columns in the current Excel file, skip to avoid overwriting existing data with 0
          if (targetAmountRaw === undefined && actualSalesRaw === undefined) {
            continue;
          }

          monthlyTargetsList.push({
            marketer_id: mId,
            media_id: mediaId,
            year_month: targetDateStr,
            target_amount: targetAmountRaw || 0,
            new_accounts_count: newAccountsRaw || 0,
            transferred_in_count: transInRaw || 0,
            transferred_out_count: transOutRaw || 0,
            live_accounts_count: liveAccountsRaw || 0,
            actual_sales_amount: actualSalesRaw || 0,
          });
        }
      }
    });

    // Aggregate duplicate keys in monthlyTargetsList to prevent target unique constraint errors
    const aggregatedMonthlyTargets = new Map<string, any>();
    monthlyTargetsList.forEach((item) => {
      const key = `${item.marketer_id}_${item.media_id}_${item.year_month}`;
      if (aggregatedMonthlyTargets.has(key)) {
        const existing = aggregatedMonthlyTargets.get(key);
        existing.target_amount += item.target_amount;
        existing.new_accounts_count += item.new_accounts_count;
        existing.transferred_in_count += item.transferred_in_count;
        existing.transferred_out_count += item.transferred_out_count;
        existing.live_accounts_count += item.live_accounts_count;
        existing.actual_sales_amount += item.actual_sales_amount;
      } else {
        aggregatedMonthlyTargets.set(key, { ...item });
      }
    });
    const finalMonthlyTargetsList = Array.from(aggregatedMonthlyTargets.values());

    const monthlyChunks = chunkArray(finalMonthlyTargetsList, 200);
    for (const chunk of monthlyChunks) {
      const { error: targetErr } = await supabase
        .from("monthly_sales_targets")
        .upsert(chunk, { onConflict: "marketer_id,media_id,year_month" });
      if (targetErr) throw new Error(`Monthly targets upsert error: ${targetErr.message}`);
    }

    // Compute the active month date string (based on daily sales dates)
    const activeTargetsDate = `${activeYear}-${String(activeMonthNum).padStart(2, "0")}-01`;

    // 9. Upsert Advertiser Period Sales
    const advertiserSalesList: any[] = [];
    advertiserData.forEach((row) => {
      const mpId = row["엠피광고주ID"];
      const mediaRaw = row["매체명"];
      const startRaw = row["매출일자1"];
      const endRaw = row["매출일자2"];
      const clickCount = Number(row["건수"] || 0);
      const amount = Number(row["매출(공급가액)"] || 0);
      const salesEmp = Number(row["매출직원"] || 1);
      const ratio = Number(row["매출비율"] || 100);

      const advId = mpId ? dbAdvertiserMap.get(mpId) : null;
      const mediaNormalized = normalizeMediaName(mediaRaw);
      const mediaId = mediaMap.get(mediaNormalized);

      let startDate: string | null = null;
      let endDate: string | null = null;

      if (startRaw) {
        if (typeof startRaw === "number") {
          const dateObj = XLSX.SSF.parse_date_code(startRaw);
          startDate = `${dateObj.y}-${String(dateObj.m).padStart(2, "0")}-${String(dateObj.d).padStart(2, "0")}`;
        } else {
          startDate = String(startRaw).trim().substring(0, 10);
        }
      }
      if (endRaw) {
        if (typeof endRaw === "number") {
          const dateObj = XLSX.SSF.parse_date_code(endRaw);
          endDate = `${dateObj.y}-${String(dateObj.m).padStart(2, "0")}-${String(dateObj.d).padStart(2, "0")}`;
        } else {
          endDate = String(endRaw).trim().substring(0, 10);
        }
      }

      if (advId && mediaId && startDate && endDate) {
        advertiserSalesList.push({
          advertiser_id: advId,
          media_id: mediaId,
          start_date: startDate,
          end_date: endDate,
          year_month: activeTargetsDate,
          click_count: clickCount,
          amount,
          sales_employee_count: salesEmp,
          sales_ratio: ratio,
        });
      }
    });

    // Aggregate duplicate keys in advertiserSalesList to prevent advertiser sales unique constraint errors
    const aggregatedAdvertiserSales = new Map<string, any>();
    advertiserSalesList.forEach((item) => {
      const key = `${item.advertiser_id}_${item.media_id}_${item.start_date}_${item.end_date}_${item.year_month}`;
      if (aggregatedAdvertiserSales.has(key)) {
        const existing = aggregatedAdvertiserSales.get(key);
        existing.click_count += item.click_count;
        existing.amount += item.amount;
      } else {
        aggregatedAdvertiserSales.set(key, { ...item });
      }
    });
    const finalAdvertiserSalesList = Array.from(aggregatedAdvertiserSales.values());

    const advSalesChunks = chunkArray(finalAdvertiserSalesList, 200);
    for (const chunk of advSalesChunks) {
      const { error: advSalesErr } = await supabase
        .from("advertiser_sales")
        .upsert(chunk, { onConflict: "advertiser_id,media_id,start_date,end_date,year_month" });
      if (advSalesErr) throw new Error(`Advertiser sales upsert error: ${advSalesErr.message}`);
    }

    // --- AI Insights Generation (Graceful Degradation) ---
    try {
      
      let teamTotalTarget = 0;
      let teamTotalSales = 0;
      const marketerSummaryMap = new Map<string, { target: number; sales: number }>();

      finalMonthlyTargetsList.forEach((item) => {
        if (item.year_month === activeTargetsDate) {
          teamTotalTarget += item.target_amount;
          teamTotalSales += item.actual_sales_amount;

          let mName = "알 수 없음";
          for (const [name, id] of dbMarketerMap.entries()) {
            if (id === item.marketer_id) {
              mName = name;
              break;
            }
          }

          if (!marketerSummaryMap.has(mName)) {
            marketerSummaryMap.set(mName, { target: 0, sales: 0 });
          }
          const mData = marketerSummaryMap.get(mName)!;
          mData.target += item.target_amount;
          mData.sales += item.actual_sales_amount;
        }
      });

      const teamAchievementRate = teamTotalTarget > 0 ? ((teamTotalSales / teamTotalTarget) * 100).toFixed(1) : "0";

      const marketerSummaries = Array.from(marketerSummaryMap.entries()).map(([name, data]) => {
        const rate = data.target > 0 ? ((data.sales / data.target) * 100).toFixed(1) : "0";
        return {
          name,
          target: data.target,
          sales: data.sales,
          achievement_rate: rate + "%",
        };
      });

      const teamTrend: Record<string, number> = {};
      const teamMedia: Record<string, number> = {};
      const teamWeekly: Record<string, number> = {};
      const marketerDetailMap = new Map<string, any>();
      
      dbMarketerMap.forEach((id, name) => {
        marketerDetailMap.set(name, { trend: {}, media: {}, weekly: {} });
      });

      finalMonthlyTargetsList.forEach((item) => {
        let mName = "알 수 없음";
        for (const [name, id] of dbMarketerMap.entries()) {
          if (id === item.marketer_id) {
            mName = name;
            break;
          }
        }
        teamTrend[item.year_month] = (teamTrend[item.year_month] || 0) + item.actual_sales_amount;
        if (marketerDetailMap.has(mName)) {
          marketerDetailMap.get(mName).trend[item.year_month] = (marketerDetailMap.get(mName).trend[item.year_month] || 0) + item.actual_sales_amount;
        }
      });

      finalDailySalesList.forEach((item) => {
        let mName = "알 수 없음";
        for (const [name, id] of dbMarketerMap.entries()) {
          if (id === item.marketer_id) {
            mName = name;
            break;
          }
        }
        let mediaName = "알 수 없음";
        for (const [name, id] of mediaMap.entries()) {
          if (id === item.media_id) {
            mediaName = name;
            break;
          }
        }
        
        if (item.sales_date && item.sales_date.startsWith(activeTargetsDate.substring(0, 7))) {
          teamMedia[mediaName] = (teamMedia[mediaName] || 0) + item.amount;
          if (marketerDetailMap.has(mName)) {
            marketerDetailMap.get(mName).media[mediaName] = (marketerDetailMap.get(mName).media[mediaName] || 0) + item.amount;
          }
          
          const date = new Date(item.sales_date);
          const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
          const dayName = days[date.getDay()];
          
          teamWeekly[dayName] = (teamWeekly[dayName] || 0) + item.amount;
          if (marketerDetailMap.has(mName)) {
            marketerDetailMap.get(mName).weekly[dayName] = (marketerDetailMap.get(mName).weekly[dayName] || 0) + item.amount;
          }
        }
      });

      const aiPromptData = {
        month: activeTargetsDate,
        team_summary: {
          total_target: teamTotalTarget,
          total_sales: teamTotalSales,
          achievement_rate: teamAchievementRate + "%",
          trend: teamTrend,
          media_share: teamMedia,
          weekly_pattern: teamWeekly
        },
        marketer_summaries: marketerSummaries.map(m => ({
          ...m,
          details: marketerDetailMap.get(m.name)
        })),
      };

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const promptStr = `너는 10년 차 탑티어 퍼포먼스 마케팅 디렉터이자 영업 관리자야.
주어진 데이터를 분석하여 '팀 전체' 및 '각 마케터별'로 매우 구체적이고 실전적인 액션 아이템과 현황 코멘트를 제안해.
각 대상(전체 및 마케터별)에 대해 아래 JSON 구조를 엄격히 지켜서 반환해:
{
  "insights": [
    {
      "marketer_name": "전체" 또는 "마케터명",
      "risk_guide": "리스크 제어 가이드 2~3문장",
      "closing_strategy": "총괄 마감 전략 제안 2~3문장",
      "marketer_desc": "해당 마케터(또는 팀)에 대한 한 줄 평 (예: 압도적 매출 1위이나 당월 이탈 주의)",
      "trend_comments": {
        "month_minus_3": "3개월 전 실적 코멘트",
        "month_minus_2": "2개월 전 실적 코멘트",
        "month_minus_1": "1개월 전 실적 코멘트",
        "current_target": "당월 목표 코멘트",
        "current_expected": "당월 예상 코멘트"
      },
      "media_comments": {
        "네이버": "네이버 매체 코멘트",
        "지마켓": "지마켓 매체 코멘트"
        // 기타 주요 매체들...
      },
      "weekly_comments": {
        "월요일": "월요일 패턴 코멘트",
        "화요일": "화요일 패턴 코멘트",
        "수요일": "수요일 패턴 코멘트",
        "목요일": "목요일 패턴 코멘트",
        "금요일": "금요일 패턴 코멘트",
        "토요일": "토요일 패턴 코멘트",
        "일요일": "일요일 패턴 코멘트"
      }
    }
  ]
}

[분석할 데이터]
${JSON.stringify(aiPromptData)}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptStr,
        config: {
          responseMimeType: "application/json",
        }
      });

      const content = response.text;
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed.insights && Array.isArray(parsed.insights)) {
          // 1. Delete existing insights for this month
          const { error: deleteErr } = await supabase
            .from("monthly_ai_insights")
            .delete()
            .eq("year_month", activeTargetsDate);
          
          if (deleteErr) {
            console.error("AI Insights Delete Error:", deleteErr);
          } else {
            // 2. Prepare insert payload
            const insertPayload = parsed.insights.map((insight: any) => {
              const mName = insight.marketer_name;
              let mId = null;
              if (mName !== "전체") {
                mId = dbMarketerMap.get(mName) || null;
              }
              return {
                year_month: activeTargetsDate,
                marketer_id: mId,
                risk_guide: insight.risk_guide,
                closing_strategy: insight.closing_strategy,
                additional_insights: {
                  marketer_desc: insight.marketer_desc,
                  trend_comments: insight.trend_comments,
                  media_comments: insight.media_comments,
                  weekly_comments: insight.weekly_comments,
                }
              };
            });

            // 3. Insert new insights
            const { error: insertErr } = await supabase
              .from("monthly_ai_insights")
              .insert(insertPayload);
            
            if (insertErr) {
              console.error("AI Insights Insert Error:", insertErr);
            }
          }
        }
      }
    } catch (aiError) {
      console.error("AI Analysis skipped or failed:", aiError);
    }
    // -----------------------------------------------------------

    return { success: true, message: "모든 엑셀 데이터가 Supabase에 정상 등록되었습니다!" };
  } catch (error: any) {
    console.error("Excel upload failed:", error);
    return { success: false, message: error.message || "서버 통신 중 오류가 발생했습니다." };
  }
}
