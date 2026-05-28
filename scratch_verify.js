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

async function fetchAll(table, select) {
  const PAGE_SIZE = 1000;
  let allData = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allData;
}

async function verify() {
  const dailySales = await fetchAll("daily_sales", "sales_date");
  console.log("Total rows fetched with pagination:", dailySales.length);

  const dates = dailySales.map(d => d.sales_date).filter(Boolean);
  const maxDate = dates.reduce((max, cur) => (cur > max ? cur : max), dates[0]);
  console.log("Max date:", maxDate);

  const aprilDates = dates.filter(d => d.startsWith("2026-04"));
  if (aprilDates.length > 0) {
    const aprilMax = aprilDates.reduce((max, cur) => (cur > max ? cur : max), aprilDates[0]);
    console.log("April max date:", aprilMax, "April row count:", aprilDates.length);
  }

  const byMonth = {};
  dates.forEach(d => {
    const month = d.substring(0, 7);
    byMonth[month] = (byMonth[month] || 0) + 1;
  });
  console.log("Rows by month:", JSON.stringify(byMonth, null, 2));
}

verify().catch(console.error);
