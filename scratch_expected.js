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

async function checkSum() {
  try {
    const { data, error } = await supabase
      .from("daily_sales")
      .select("amount, sales_date")
      .gte("sales_date", "2026-04-01")
      .lte("sales_date", "2026-04-12")
      .limit(100000);

    if (error) throw error;

    const totalSales = data.reduce((sum, row) => sum + Number(row.amount), 0);
    const expected = (totalSales / 12) * 30;

    console.log("Total sales (April 1-12):", totalSales);
    console.log("Expected sales:", expected);

  } catch (err) {
    console.error(err);
  }
}

checkSum();
