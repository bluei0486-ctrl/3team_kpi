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

async function fetchAprilSales() {
  try {
    const { data: salesData, error } = await supabase
      .from("daily_sales")
      .select("amount, sales_date, marketers(name)")
      .gte("sales_date", "2026-04-01")
      .lte("sales_date", "2026-04-30")
      .limit(100000);

    if (error) {
      console.error("Error fetching data:", error);
      return;
    }

    const marketerSales = {};

    salesData.forEach(row => {
      const marketerName = row.marketers ? row.marketers.name : "Unknown";
      if (!marketerSales[marketerName]) {
        marketerSales[marketerName] = 0;
      }
      marketerSales[marketerName] += Number(row.amount);
    });

    // Format output
    const result = Object.keys(marketerSales).map(name => ({
      마케터: name,
      "4월 매출액": marketerSales[name]
    })).sort((a, b) => b["4월 매출액"] - a["4월 매출액"]);

    console.log(JSON.stringify(result, null, 2));

  } catch (err) {
    console.error(err);
  }
}

fetchAprilSales();
