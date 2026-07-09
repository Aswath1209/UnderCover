const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('scratch/wiki_htmls/SRH.html', 'utf8');
const $ = cheerio.load(html);

$('table.wikitable').each((idx, table) => {
  const headerText = $(table).find('tr').first().text().replace(/\s+/g, ' ').trim().toLowerCase();
  console.log(`Table ${idx} headerText: "${headerText}"`);
  console.log(`  includes 'name': ${headerText.includes('name')}`);
  console.log(`  includes 'nat': ${headerText.includes('nat')}`);
  console.log(`  includes 'style': ${headerText.includes('style')}`);
});
