const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const teams = {
  CSK: '2026_Chennai_Super_Kings_season',
  RCB: '2026_Royal_Challengers_Bengaluru_season',
  MI: '2026_Mumbai_Indians_season',
  KKR: '2026_Kolkata_Knight_Riders_season',
  SRH: '2026_Sunrisers_Hyderabad_season',
  DC: '2026_Delhi_Capitals_season',
  GT: '2026_Gujarat_Titans_season',
  LSG: '2026_Lucknow_Super_Giants_season',
  PBKS: '2026_Punjab_Kings_season',
  RR: '2026_Rajasthan_Royals_season'
};

async function downloadPages() {
  const dir = path.join(__dirname, 'wiki_htmls');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  for (const [code, pageName] of Object.entries(teams)) {
    const filePath = path.join(dir, `${code}.html`);
    if (fs.existsSync(filePath)) {
      console.log(`Already downloaded ${code}`);
      continue;
    }
    const url = `https://en.wikipedia.org/wiki/${pageName}`;
    console.log(`Downloading ${code} from ${url}...`);
    try {
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      fs.writeFileSync(filePath, res.data);
      // Wait a little to avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error(`Failed to download ${code}:`, err.message);
    }
  }
}

function parseRosters() {
  const dir = path.join(__dirname, 'wiki_htmls');
  const scraped = {};

  for (const code of Object.keys(teams)) {
    const filePath = path.join(dir, `${code}.html`);
    if (!fs.existsSync(filePath)) continue;

    const html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html);

    let rosterTable = null;

    $('table.wikitable').each((idx, table) => {
      const headerText = $(table).find('tr').first().text().replace(/\s+/g, ' ').trim().toLowerCase();
      if ((headerText.includes('name') || headerText.includes('player')) && 
          (headerText.includes('nationality') || headerText.includes('nat ')) && 
          (headerText.includes('style') || headerText.includes('batting') || headerText.includes('bowling'))) {
        rosterTable = table;
      }
    });

    if (!rosterTable) {
      // Fallback: look for any wikitable containing "batting style"
      $('table.wikitable').each((idx, table) => {
        const text = $(table).text().replace(/\s+/g, ' ').trim().toLowerCase();
        if (text.includes('batting style') && (text.includes('nationality') || text.includes('nat '))) {
          rosterTable = table;
        }
      });
    }

    if (!rosterTable) {
      console.error(`❌ Could not find roster table for ${code}`);
      continue;
    }

    const roster = [];
    const headers = [];
    $(rosterTable).find('tr').first().find('th, td').each((i, el) => {
      headers.push($(el).text().trim().toLowerCase());
    });

    const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('player'));
    const natIdx = headers.findIndex(h => h.includes('nationality') || h.includes('nat'));
    const batIdx = headers.findIndex(h => h.includes('batting'));
    const bowlIdx = headers.findIndex(h => h.includes('bowling'));

    $(rosterTable).find('tr').each((rowIdx, tr) => {
      if (rowIdx === 0) return; // skip header

      const cells = [];
      $(tr).find('td').each((colIdx, td) => {
        cells.push($(td).text().trim().replace(/\s+/g, ' '));
      });

      if (cells.length > 0 && cells[nameIdx]) {
        // Clean name (remove symbols like dagger, asterisk, footnotes)
        let name = cells[nameIdx].replace(/[†*‡#]/g, '').trim();
        // Remove trailing footnote links like [a], [b], [1]
        name = name.replace(/\[\w+\]/g, '').trim();

        const nationality = cells[natIdx] ? cells[natIdx].replace(/\[\w+\]/g, '').trim() : '';
        const batting = cells[batIdx] ? cells[batIdx].replace(/\[\w+\]/g, '').trim() : '';
        let bowling = cells[bowlIdx] ? cells[bowlIdx].replace(/\[\w+\]/g, '').trim() : '';

        // Clean up bowling text if it contains sr-only content
        if (bowling.includes('.mw-parser-output')) {
          bowling = bowling.split('}').pop().trim();
        }
        if (bowling.toLowerCase().startsWith('n/a') || bowling.trim() === '—') {
          bowling = 'None';
        }

        roster.push({
          name,
          nationality,
          batting,
          bowling
        });
      }
    });

    console.log(`✅ Parsed ${roster.length} players for ${code}`);
    scraped[code] = roster;
  }

  fs.writeFileSync(
    path.join(__dirname, 'ipl_2026_scraped.json'),
    JSON.stringify(scraped, null, 2),
    'utf8'
  );
  console.log("Saved ipl_2026_scraped.json");
}

async function main() {
  await downloadPages();
  parseRosters();
}

main().catch(console.error);
