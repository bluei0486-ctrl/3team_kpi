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

async function checkMonthlySales() {
  try {
    const { data: targetsData, error } = await supabase
      .from("monthly_sales_targets")
      .select("actual_sales_amount, year_month, marketers(name)")
      .eq("year_month", "2026-04-01")
      .limit(100000);

    if (error) {
      console.error("Error fetching data:", error);
      return;
    }

    const marketerSales = {};

    targetsData.forEach(row => {
      const marketerName = row.marketers ? row.marketers.name : "Unknown";
      if (!marketerSales[marketerName]) {
        marketerSales[marketerName] = 0;
      }
      marketerSales[marketerName] += Number(row.actual_sales_amount);
    });

    console.log("=== monthly_sales_targets (2026-04-01) ===");
    console.log(JSON.stringify(marketerSales, null, 2));

  } catch (err) {
    console.error(err);
  }
}

checkMonthlySales();
