const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, '..', 'data', 'cricketplayers.sql');
const cachePath = path.join(__dirname, 'bowling_styles_cache.json');

function getSqlPlayers() {
  const content = fs.readFileSync(sqlPath, 'utf8');
  const lines = content.split('\n');
  const insertPrefix = 'INSERT INTO "public"."cricketplayers" ("id", "name", "country", "role", "batting_rating", "bowling_rating", "ovr", "bowler_type", "buy_price", "image_url", "created_at", "tier", "batting_archetype", "bowling_archetype") VALUES ';
  const insertLineIdx = lines.findIndex(l => l.startsWith(insertPrefix));
  if (insertLineIdx === -1) {
    console.error("Could not find the INSERT line.");
    process.exit(1);
  }
  const insertLine = lines[insertLineIdx];
  const valuesPart = insertLine.substring(insertPrefix.length).trim();
  const valuesStr = valuesPart.endsWith(';') ? valuesPart.slice(0, -1) : valuesPart;

  function parseSqlValues(str) {
    const records = [];
    let i = 0;
    const len = str.length;
    while (i < len) {
      while (i < len && str[i] !== '(') i++;
      if (i >= len) break;
      i++;
      const fields = [];
      let currentField = '';
      let inQuote = false;
      while (i < len) {
        const char = str[i];
        if (inQuote) {
          if (char === "'") {
            if (i + 1 < len && str[i + 1] === "'") {
              currentField += "'";
              i += 2;
            } else {
              inQuote = false;
              i++;
            }
          } else {
            currentField += char;
            i++;
          }
        } else {
          if (char === "'") {
            inQuote = true;
            i++;
          } else if (char === ',') {
            fields.push(currentField.trim());
            currentField = '';
            i++;
          } else if (char === ')') {
            fields.push(currentField.trim());
            records.push(fields);
            i++;
            break;
          } else {
            currentField += char;
            i++;
          }
        }
      }
    }
    return records;
  }

  const parsedRecords = parseSqlValues(valuesStr);
  return parsedRecords.map(r => {
    return {
      id: r[0],
      name: r[1],
      country: r[2] === 'null' ? null : r[2],
      role: r[3] === 'null' ? null : r[3],
      batting_rating: r[4] === 'null' ? null : parseInt(r[4]),
      bowling_rating: r[5] === 'null' ? null : parseInt(r[5]),
      ovr: r[6] === 'null' ? null : parseInt(r[6]),
      bowler_type: r[7] === 'null' ? null : r[7],
      buy_price: r[8] === 'null' ? null : parseInt(r[8]),
      image_url: r[9] === 'null' ? null : r[9],
      created_at: r[10] === 'null' ? null : r[10],
      tier: r[11] === 'null' ? null : r[11],
      batting_archetype: r[12] === 'null' ? null : r[12],
      bowling_archetype: r[13] === 'null' ? null : r[13]
    };
  });
}

function run() {
  const players = getSqlPlayers();
  let cache = {};
  if (fs.existsSync(cachePath)) {
    cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  }

  const uncached = players.filter(p => !cache[p.name] && (p.role === 'bowler' || p.role === 'all_rounder' || (p.bowling_rating && p.bowling_rating >= 40)));
  console.log(`Total uncached bowlers/all-rounders/bowling batsmen: ${uncached.length}`);
  
  uncached.sort((a, b) => b.ovr - a.ovr);
  console.log("\nTop 40 uncached bowlers by OVR:");
  console.log(uncached.slice(0, 40).map(p => `${p.name} (OVR: ${p.ovr}, Role: ${p.role}, Bowler Type: ${p.bowler_type})`));
}

run();
