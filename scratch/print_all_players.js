const cheerio = require('cheerio');
const fs = require('fs');

function run() {
  const html = fs.readFileSync('scratch/csk_2026.html', 'utf8');
  const $ = cheerio.load(html);

  const table = $('table.wikitable').eq(2);
  console.log("CSK 2026 Roster (Wikitable Index 2):");
  
  table.find('tr').each((i, tr) => {
    if (i === 0) return; // skip header
    const cells = [];
    $(tr).find('td').each((j, td) => {
      cells.push($(td).text().trim().replace(/\s+/g, ' '));
    });
    if (cells.length > 0) {
      console.log(`- Name: "${cells[1]}" | Nationality: ${cells[2]} | Batting: ${cells[4]} | Bowling: ${cells[5]}`);
    }
  });
}

run();
