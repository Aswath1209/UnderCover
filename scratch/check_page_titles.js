const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const codes = ['CSK', 'RCB', 'MI', 'KKR', 'SRH', 'DC', 'GT', 'LSG', 'PBKS', 'RR'];

for (const code of codes) {
  const filePath = path.join(__dirname, 'wiki_htmls', `${code}.html`);
  if (!fs.existsSync(filePath)) {
    console.log(`${code}: File not found`);
    continue;
  }
  const html = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(html);
  const title = $('title').text();
  console.log(`${code}: Title = "${title}"`);
}
