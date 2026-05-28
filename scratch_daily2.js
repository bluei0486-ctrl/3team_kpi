const XLSX = require("xlsx");
const fs = require("fs");

function analyzeDaily(filename) {
    const buf = fs.readFileSync(filename);
    const wb = XLSX.read(buf, {type: "buffer"});
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log("Total rows:", data.length);
}

analyzeDaily("마케터별 일별매출_4월.xls");
