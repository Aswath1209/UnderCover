const cheerio = require('cheerio');
const fs = require('fs');

function run() {
  const html = fs.readFileSync('scratch/csk_2026.html', 'utf8');
  const $ = cheerio.load(html);

  console.log(`Total wikitables: ${$('table.wikitable').length}`);
  
  $('table.wikitable').each((i, table) => {
    console.log(`\n--- Wikitable Index ${i} ---`);
    $(table).find('tr').slice(0, 4).each((j, tr) => {
      const cells = [];
      $(tr).find('th, td').each((k, td) => {
        cells.push($(td).text().trim().replace(/\s+/g, ' '));
      });
      console.log(` Row ${j}: ${cells.join(' | ')}`);
    });
  });
}

run();
