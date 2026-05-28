import { createClient } from "@/utils/supabase/server";
import DashboardClient from "@/components/DashboardClient";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0; // Disable caching to always get fresh data

function normalizeMediaName(name: string): string {
  if (!name) return "기타";
  const trimmed = name.trim();
  if (trimmed === "네이버" || trimmed === "네이버GFA") return "네이버";
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

export default async function DashboardPage() {
  let isDemo = true;
  let databaseData = null;

  try {
    const supabase = await createClient();
    
    // Check if we have any daily sales records to determine if DB is populated
    const { count, error } = await supabase
      .from("daily_sales")
      .select("*", { count: "exact", head: true });

    if (!error && count && count > 0) {
      isDemo = false;

      // Supabase PostgREST enforces server-side max_rows (default 1000).
      // We must paginate to fetch all rows.
      async function fetchAll(table: string, select: string) {
        const PAGE_SIZE = 1000;
        let allData: any[] = [];
        let from = 0;
        while (true) {
          const { data, error: fetchErr } = await supabase
            .from(table)
            .select(select)
            .range(from, from + PAGE_SIZE - 1);
          if (fetchErr || !data || data.length === 0) break;
          allData = allData.concat(data);
          if (data.length < PAGE_SIZE) break; // last page
          from += PAGE_SIZE;
        }
        return allData;
      }

      const [marketers, advertisers, dailySales, targets, advertiserSales, aiInsights] = await Promise.all([
        fetchAll("marketers", "*"),
        fetchAll("advertisers", "*"),
        fetchAll("daily_sales", "*, marketers(name), media(name)"),
        fetchAll("monthly_sales_targets", "*, marketers(name), media(name)"),
        fetchAll("advertiser_sales", "*, year_month, advertisers(name, marketer_id), media(name)"),
        fetchAll("monthly_ai_insights", "*, marketers(name)")
      ]);

      databaseData = {
        marketers,
        advertisers,
        dailySales,
        targets,
        advertiserSales,
        aiInsights
      };
    } else {
      // Fallback: Read and parse local Excel files if they exist
      const dailyPath = path.join(process.cwd(), "마케터별 일별매출.xls");
      const monthlyPath = path.join(process.cwd(), "마케터별 월간매출.xls");
      const advPath = path.join(process.cwd(), "광고주 기간매출.xlsx");

      if (fs.existsSync(dailyPath) && fs.existsSync(monthlyPath) && fs.existsSync(advPath)) {
        try {
          isDemo = false;

          // Read file buffers first to avoid Windows file sharing lock/access issues when Excel is open
          const dailyBuffer = fs.readFileSync(dailyPath);
          const monthlyBuffer = fs.readFileSync(monthlyPath);
          const advBuffer = fs.readFileSync(advPath);

          const dailyWb = XLSX.read(dailyBuffer, { type: "buffer" });
          const monthlyWb = XLSX.read(monthlyBuffer, { type: "buffer" });
          const advWb = XLSX.read(advBuffer, { type: "buffer" });

          const dailySheet = dailyWb.Sheets[dailyWb.SheetNames[0]];
        const dailyData = XLSX.utils.sheet_to_json<any>(dailySheet);

        const monthlySheet = monthlyWb.Sheets[monthlyWb.SheetNames[0]];
        const monthlyDataRaw = XLSX.utils.sheet_to_json<any>(monthlySheet);
        // Filter out 합계 (subtotal) rows to avoid double-counting
        const monthlyData = monthlyDataRaw.filter((row: any) => {
          const media = row["매체명"] || "";
          return !media.startsWith("합계");
        });

        const advertiserSheet = advWb.Sheets[advWb.SheetNames[0]];
        const advertiserData = XLSX.utils.sheet_to_json<any>(advertiserSheet);

        // 1. Media
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

        const mediaMap = new Map<string, string>();
        const mediaList: any[] = [];
        uniqueMediaNames.forEach((name) => {
          const id = randomUUID();
          mediaMap.set(name, id);
          mediaList.push({ id, name });
        });

        // 2. Marketers
        const marketerTempMap = new Map<string, { name: string; hire_date?: string }>();
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
            marketerTempMap.set(name, { name, hire_date: hireDate });
          }
        });

        const marketerCodeMap = new Map<string, string>();
        advertiserData.forEach((row) => {
          const name = row["마케터명"] || row["직원명"];
          const code = row["마케터ID"];
          if (name && code) {
            marketerCodeMap.set(name, code);
          }
        });

        const dbMarketerMap = new Map<string, string>();
        const marketersList: any[] = [];
        Array.from(marketerTempMap.values()).forEach((m) => {
          const id = randomUUID();
          dbMarketerMap.set(m.name, id);
          marketersList.push({
            id,
            name: m.name,
            employee_code: marketerCodeMap.get(m.name) || null,
            hire_date: m.hire_date || null,
            department: "3팀",
          });
        });

        // 3. Advertisers
        const advertiserUpsertMap = new Map<string, any>();
        advertiserData.forEach((row) => {
          const mpId = row["엠피광고주ID"];
          const mpName = row["엠피광고주명"];
          const advId = row["광고주ID"];
          const advName = row["광고주명"];
          const marketerName = row["마케터명"] || row["직원명"];

          if (mpId && advName) {
            const id = randomUUID();
            advertiserUpsertMap.set(mpId, {
              id,
              mp_advertiser_id: mpId,
              mp_advertiser_name: mpName || null,
              advertiser_code: advId || null,
              name: advName,
              marketer_id: marketerName ? dbMarketerMap.get(marketerName) || null : null,
            });
          }
        });

        const advertisersList = Array.from(advertiserUpsertMap.values());
        const dbAdvertiserMap = new Map<string, string>();
        advertisersList.forEach((a) => dbAdvertiserMap.set(a.mp_advertiser_id, a.id));

        // 4. Daily Sales
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
              id: randomUUID(),
              marketer_id: mId,
              media_id: mediaId,
              sales_date: salesDate,
              amount,
              marketers: { name: mName },
              media: { name: mediaNormalized }
            });
          }
        });

        // 5. Monthly Sales Targets & History
        let maxDateInFile: string | null = null;
        const datesInFile: string[] = [];
        dailyData.forEach((row: any) => {
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

              // If this month doesn't have any relevant columns in the current Excel file, skip to avoid 0s
              if (targetAmountRaw === undefined && actualSalesRaw === undefined) {
                continue;
              }

              monthlyTargetsList.push({
                id: randomUUID(),
                marketer_id: mId,
                media_id: mediaId,
                year_month: targetDateStr,
                target_amount: targetAmountRaw || 0,
                new_accounts_count: newAccountsRaw || 0,
                transferred_in_count: transInRaw || 0,
                transferred_out_count: transOutRaw || 0,
                live_accounts_count: liveAccountsRaw || 0,
                actual_sales_amount: actualSalesRaw || 0,
                marketers: { name: mName },
                media: { name: mediaNormalized }
              });
            }
          }
        });

        // 6. Advertiser Period Sales
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
          const marketerName = row["마케터명"] || row["직원명"] || "미지정";

          const advId = mpId ? dbAdvertiserMap.get(mpId) : null;
          const advName = row["광고주명"] || mpId;
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
            const activeMonthDate = `${activeYear}-${String(activeMonthNum).padStart(2, "0")}-01`;
            advertiserSalesList.push({
              id: randomUUID(),
              advertiser_id: advId,
              media_id: mediaId,
              start_date: startDate,
              end_date: endDate,
              year_month: activeMonthDate,
              click_count: clickCount,
              amount,
              sales_employee_count: salesEmp,
              sales_ratio: ratio,
              advertisers: {
                name: advName,
                marketer_id: marketerName ? dbMarketerMap.get(marketerName) || null : null
              },
              media: { name: mediaNormalized }
            });
          }
        });

          databaseData = {
            marketers: marketersList,
            advertisers: advertisersList,
            dailySales: dailySalesList,
            targets: monthlyTargetsList,
            advertiserSales: advertiserSalesList,
            aiInsights: [] // Empty fallback for local excel parsing
          };
        } catch (excelError) {
          console.error("Local Excel parsing failed, falling back to demo mode:", excelError);
          isDemo = true;
          databaseData = null;
        }
      }
    }
  } catch (err) {
    console.error("Supabase connection error, falling back to demo data:", err);
  }

  return (
    <DashboardClient isDemo={isDemo} initialData={databaseData} />
  );
}
