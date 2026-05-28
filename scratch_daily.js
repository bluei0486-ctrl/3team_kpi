const XLSX = require("xlsx");
const fs = require("fs");

function analyzeDaily(filename) {
    const buf = fs.readFileSync(filename);
    const wb = XLSX.read(buf, {type: "buffer"});
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    let maxDate = null;
    let countByDate = {};

    data.forEach((row) => {
      const salesDateRaw = row["매출일"];
      let salesDate = null;
      if (salesDateRaw) {
        if (typeof salesDateRaw === "number") {
          const dateObj = XLSX.SSF.parse_date_code(salesDateRaw);
          salesDate = `${dateObj.y}-${String(dateObj.m).padStart(2, "0")}-${String(dateObj.d).padStart(2, "0")}`;
        } else {
          salesDate = String(salesDateRaw).trim().substring(0, 10);
        }
        
        if (!maxDate || salesDate > maxDate) {
            maxDate = salesDate;
        }
        countByDate[salesDate] = (countByDate[salesDate] || 0) + 1;
      }
    });

    console.log("File:", filename);
    console.log("Max Date:", maxDate);
    const sortedDates = Object.keys(countByDate).sort();
    console.log("Dates:", sortedDates);
}

analyzeDaily("마케터별 일별매출_4월.xls");
