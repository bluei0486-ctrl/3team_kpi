const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const envVars = fs.readFileSync(".env.local", "utf8").split("\n");
let supabaseUrl = "";
let supabaseKey = "";

envVars.forEach(line => {
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
    supabaseUrl = line.split("=")[1].trim();
  } else if (line.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")) {
    supabaseKey = line.split("=")[1].trim();
  }
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  // 1. Count total daily_sales
  const { count: totalCount, error: countErr } = await supabase
    .from("daily_sales")
    .select("*", { count: "exact", head: true });
  console.log("=== Total daily_sales count in DB:", totalCount, "error:", countErr);

  // 2. Fetch with limit(100000) - same as page.tsx
  const { data: dailySales, error: fetchErr } = await supabase
    .from("daily_sales")
    .select("*, marketers(name), media(name)")
    .limit(100000);
  console.log("=== Fetched rows with limit(100000):", dailySales?.length, "error:", fetchErr);

  if (dailySales && dailySales.length > 0) {
    // Find max date
    const dates = dailySales.map(d => d.sales_date).filter(Boolean);
    const maxDate = dates.reduce((max, cur) => (cur > max ? cur : max), dates[0]);
    const minDate = dates.reduce((min, cur) => (cur < min ? cur : min), dates[0]);
    console.log("=== Date range:", minDate, "to", maxDate);

    // Count by month
    const byMonth = {};
    dates.forEach(d => {
      const month = d.substring(0, 7);
      byMonth[month] = (byMonth[month] || 0) + 1;
    });
    console.log("=== Rows by month:", JSON.stringify(byMonth, null, 2));

    // For April specifically, what's the max date?
    const aprilDates = dates.filter(d => d.startsWith("2026-04"));
    if (aprilDates.length > 0) {
      const aprilMax = aprilDates.reduce((max, cur) => (cur > max ? cur : max), aprilDates[0]);
      console.log("=== April max date:", aprilMax, "April row count:", aprilDates.length);
    }
  }

  // 3. Also check what the page.tsx query actually gets without limit
  const { data: noLimitData, error: noLimitErr } = await supabase
    .from("daily_sales")
    .select("sales_date");
  console.log("=== Without explicit limit, rows returned:", noLimitData?.length);
  if (noLimitData && noLimitData.length > 0) {
    const dates2 = noLimitData.map(d => d.sales_date).filter(Boolean);
    const maxDate2 = dates2.reduce((max, cur) => (cur > max ? cur : max), dates2[0]);
    console.log("=== Without limit max date:", maxDate2);
  }
}

diagnose().catch(console.error);
