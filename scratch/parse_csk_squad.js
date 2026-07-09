const cheerio = require('cheerio');
const fs = require('fs');

function run() {
  const html = fs.readFileSync('scratch/csk_2026.html', 'utf8');
  const $ = cheerio.load(html);

  console.log("Searching for tables containing 'Dhoni' or 'Gaikwad'...");

  $('table').each((i, table) => {
    const text = $(table).text();
    if (text.includes("Dhoni") || text.includes("Gaikwad")) {
      console.log(`\nTable index: ${i}`);
      console.log(`Class: ${$(table).attr('class')}`);
      
      // Print first 5 rows to see structure
      $(table).find('tr').slice(0, 8).each((j, tr) => {
        const cells = [];
        $(tr).find('th, td').each((k, td) => {
          cells.push($(td).text().trim().replace(/\s+/g, ' '));
        });
        console.log(` Row ${j}:`, cells.join(' | '));
      });
    }
  });
}

run();
