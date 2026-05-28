const XLSX = require("xlsx");
const fs = require("fs");

function analyzeFile(filename) {
    const buf = fs.readFileSync(filename);
    const wb = XLSX.read(buf, {type: "buffer"});
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log("File:", filename);
    if (data.length > 0) {
        console.log("Headers:", Object.keys(data[0]));
    }
    
    // Sum 1월 매출, 2월 매출, 3월 매출, 4월 누적 or 4월 매출
    let janSales = 0;
    let febSales = 0;
    let marSales = 0;
    let aprSales = 0;
    let maySales = 0;

    data.forEach(row => {
        // filter out '합계' media
        if (row["매체명"] && row["매체명"].startsWith("합계")) return;
        
        // Sum values based on headers like "1월매출액", "4월누적"
        for (const key of Object.keys(row)) {
            if (/1월\s*(매출액|매출|누적)/.test(key)) janSales += Number(row[key] || 0);
            if (/2월\s*(매출액|매출|누적)/.test(key)) febSales += Number(row[key] || 0);
            if (/3월\s*(매출액|매출|누적)/.test(key)) marSales += Number(row[key] || 0);
            if (/4월\s*(매출액|매출|누적)/.test(key)) aprSales += Number(row[key] || 0);
            if (/5월\s*(매출액|매출|누적)/.test(key)) maySales += Number(row[key] || 0);
        }
    });

    console.log("1월 Sales:", janSales);
    console.log("2월 Sales:", febSales);
    console.log("3월 Sales:", marSales);
    console.log("4월 Sales:", aprSales);
    console.log("5월 Sales:", maySales);
    console.log("-----------------------");
}

analyzeFile("마케터별 월간매출_4월.xls");
analyzeFile("마케터별 월간매출_5월.xls");
