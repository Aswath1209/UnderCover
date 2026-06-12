const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'cricketplayers.sql');
const content = fs.readFileSync(filePath, 'utf8');
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
    while (i < len && str[i] !== '(') {
      i++;
    }
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
const players = parsedRecords.map(r => {
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

console.log(`Loaded ${players.length} players.`);

// Filter players that are bowlers or all_rounders, or have bowler_type set, or have bowling_rating > 40
// And let's see their bowler_type value
const bowlers = players.filter(p => p.role === 'bowler' || p.role === 'all_rounder' || p.bowler_type);
console.log(`Found ${bowlers.length} players with bowling features.`);

// Print out the unique values of bowler_type
const types = new Set(bowlers.map(b => b.bowler_type));
console.log("Unique bowler types in SQL file:", Array.from(types));

// Let's print out all bowlers whose bowler_type is "fast" but they might be spinners,
// or check what names are there. Let's write them to a JSON file to inspect if needed, or filter.
const spinners = bowlers.filter(b => b.bowler_type === 'off_spin' || b.bowler_type === 'leg_spin');
console.log(`Found ${spinners.length} spin bowlers in SQL file.`);

// Print some fast bowlers
const fastBowlers = bowlers.filter(b => b.bowler_type === 'fast');
console.log(`Found ${fastBowlers.length} fast bowlers in SQL file.`);
console.log("Sample fast bowlers:", fastBowlers.slice(0, 30).map(b => `${b.name} (${b.country}, role: ${b.role})`));

// Check Abrar Ahmed specifically
const abrar = players.find(p => p.name.toLowerCase().includes('abrar'));
if (abrar) {
  console.log("Abrar Ahmed found:", abrar);
} else {
  console.log("Abrar Ahmed not found in SQL file by exact name!");
}
