const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, '..', 'data', 'cricketplayers.sql');
const cachePath = path.join(__dirname, 'bowling_styles_cache.json');

function getSqlPlayers() {
  const content = fs.readFileSync(sqlPath, 'utf8');
  const lines = content.split('\n');
  const insertPrefix = 'INSERT INTO "public"."cricketplayers" ("id", "name", "country", "role", "batting_rating", "bowling_rating", "ovr", "bowler_type", "buy_price", "image_url", "created_at", "tier", "batting_archetype", "bowling_archetype") VALUES ';
  const insertStartIdx = lines.findIndex(l => l.startsWith(insertPrefix));
  if (insertStartIdx === -1) {
    console.error("Could not find the INSERT line.");
    process.exit(1);
  }
  
  let insertContent = '';
  for (let i = insertStartIdx; i < lines.length; i++) {
    insertContent += lines[i] + '\n';
    if (lines[i].includes(';')) {
      break;
    }
  }
  
  const valuesPart = insertContent.substring(insertPrefix.length).trim();
  const valuesStr = valuesPart.endsWith(';') ? valuesPart.slice(0, -1) : (valuesPart.endsWith(';\n') ? valuesPart.slice(0, -2) : valuesPart.trim().replace(/;$/, ''));

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

  console.log(`Total players in SQL: ${players.length}`);
  console.log(`Total cached players: ${Object.keys(cache).length}`);

  const bowlingPlayers = players.filter(p => p.role === 'bowler' || p.role === 'all_rounder' || (p.bowling_rating && p.bowling_rating >= 40));
  console.log(`Total players to check: ${bowlingPlayers.length}`);

  // How many of the checked ones are already cached?
  const cachedCheck = bowlingPlayers.filter(p => cache[p.name]);
  console.log(`Cached check progress: ${cachedCheck.length} / ${bowlingPlayers.length} (${(cachedCheck.length / bowlingPlayers.length * 100).toFixed(1)}%)`);

  // Let's filter to high OVR players (OVR >= 80)
  const highOvr = bowlingPlayers.filter(p => p.ovr >= 80);
  const highOvrCached = highOvr.filter(p => cache[p.name]);
  console.log(`High OVR (>=80) progress: ${highOvrCached.length} / ${highOvr.length} (${(highOvrCached.length / highOvr.length * 100).toFixed(1)}%)`);

  // Let's list the ones with corrections needed that are already cached
  const corrections = [];
  for (const p of bowlingPlayers) {
    const cached = cache[p.name];
    if (cached && !cached.error && cached.classified_bowler_type) {
      if (p.bowler_type !== cached.classified_bowler_type) {
        corrections.push({
          name: p.name,
          ovr: p.ovr,
          role: p.role,
          original: p.bowler_type,
          new: cached.classified_bowler_type,
          styleText: cached.styleText
        });
      }
    }
  }

  console.log(`\nIdentified corrections so far: ${corrections.length}`);
  corrections.sort((a, b) => b.ovr - a.ovr);
  console.log("Corrections sample (top OVR):");
  console.log(corrections.slice(0, 40));
}

run();
