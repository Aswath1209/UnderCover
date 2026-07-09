const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const codes = ['SRH', 'GT', 'LSG', 'PBKS', 'RR'];

for (const code of codes) {
  const filePath = path.join(__dirname, 'wiki_htmls', `${code}.html`);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found for ${code}`);
    continue;
  }
  const html = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(html);
  
  console.log(`\n=================== ${code} ===================`);
  $('table.wikitable').each((idx, table) => {
    const text = $(table).find('tr').first().text().replace(/\s+/g, ' ').trim();
    console.log(`Table ${idx}: Header: "${text}"`);
    // Print first body row to see details
    const firstBodyRow = $(table).find('tr').eq(1).text().replace(/\s+/g, ' ').trim();
    console.log(`  Row 1: "${firstBodyRow.slice(0, 100)}"`);
  });
}
