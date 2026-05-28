const XLSX = require("xlsx");
const fs = require("fs");

function analyzeAdv(filename) {
    const buf = fs.readFileSync(filename);
    const wb = XLSX.read(buf, {type: "buffer"});
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log("Total rows:", data.length);
}

analyzeAdv("광고주 기간매출_4월.xlsx");
