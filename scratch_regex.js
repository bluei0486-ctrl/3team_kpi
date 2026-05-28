const keys = ['4월목표', '1월 매출액', '4월 누적', '5월신규', '5월라이브율'];

function testRegex(monthNum, suffixes) {
  for (const suffix of suffixes) {
    const regex = new RegExp(`^\\s*${monthNum}\\s*월\\s*${suffix}\\s*$`);
    console.log("Regex:", regex);
    for (const key of keys) {
      if (regex.test(key)) {
        console.log(`Matched! key: "${key}", suffix: "${suffix}"`);
      }
    }
  }
}

testRegex(4, ["누적", "매출액", "매출", "목표"]);
testRegex(1, ["매출액"]);
testRegex(5, ["신규"]);
