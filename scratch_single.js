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

async function checkSingleData() {
  try {
    const { data, error } = await supabase
      .from("daily_sales")
      .select("amount, sales_date, marketers!inner(name), media!inner(name)")
      .eq("sales_date", "2026-04-30")
      .eq("marketers.name", "장평화")
      .eq("media.name", "네이버");

    if (error) {
      console.error("Error fetching data:", error);
      return;
    }

    console.log("=== 장평화 4월 30일 네이버 매출 ===");
    console.log(JSON.stringify(data, null, 2));

  } catch (err) {
    console.error(err);
  }
}

checkSingleData();
