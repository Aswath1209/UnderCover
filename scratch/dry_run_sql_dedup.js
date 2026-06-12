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
// The valuesPart ends with a semicolon. Strip it.
const valuesStr = valuesPart.endsWith(';') ? valuesPart.slice(0, -1) : valuesPart;

console.log("Parsing values...");

// Parse the values string character by character to handle nested quotes and parentheses
function parseSqlValues(str) {
  const records = [];
  let i = 0;
  const len = str.length;

  while (i < len) {
    // Skip whitespace, commas, etc. until we find '('
    while (i < len && str[i] !== '(') {
      i++;
    }
    if (i >= len) break;

    // Found start of record '('
    i++; // move past '('
    
    const fields = [];
    let currentField = '';
    let inQuote = false;

    while (i < len) {
      const char = str[i];

      if (inQuote) {
        if (char === "'") {
          // Check if it's an escaped quote ''
          if (i + 1 < len && str[i + 1] === "'") {
            currentField += "'";
            i += 2; // skip both
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
console.log(`Parsed ${parsedRecords.length} records.`);

// Map back to objects
// Columns:
// 0: id, 1: name, 2: country, 3: role, 4: batting_rating, 5: bowling_rating, 6: ovr, 7: bowler_type, 8: buy_price, 9: image_url, 10: created_at, 11: tier, 12: batting_archetype, 13: bowling_archetype
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

// Group by name
const nameMap = {};
players.forEach(p => {
  if (!nameMap[p.name]) {
    nameMap[p.name] = [];
  }
  nameMap[p.name].push(p);
});

console.log("\n--- Deduplication Simulation ---");
const toKeep = [];
const toDelete = [];

for (const [name, list] of Object.entries(nameMap)) {
  if (list.length > 1) {
    // Sort by OVR desc, then buy_price desc, then id (deterministic)
    list.sort((a, b) => {
      if ((b.ovr || 0) !== (a.ovr || 0)) {
        return (b.ovr || 0) - (a.ovr || 0);
      }
      if ((b.buy_price || 0) !== (a.buy_price || 0)) {
        return (b.buy_price || 0) - (a.buy_price || 0);
      }
      return a.id.localeCompare(b.id);
    });

    const keep = list[0];
    const deletes = list.slice(1);
    toKeep.push(keep);
    toDelete.push(...deletes);

    console.log(`Player: "${name}"`);
    console.log(`  KEEP: ID: ${keep.id} | OVR: ${keep.ovr} | Price: ${keep.buy_price} | Role: ${keep.role}`);
    deletes.forEach(d => {
      console.log(`  DEL : ID: ${d.id} | OVR: ${d.ovr} | Price: ${d.buy_price} | Role: ${d.role}`);
    });
  } else {
    toKeep.push(list[0]);
  }
}

console.log(`\nSummary:`);
console.log(`Original total: ${players.length}`);
console.log(`Unique names: ${Object.keys(nameMap).length}`);
console.log(`To keep: ${toKeep.length}`);
console.log(`To delete: ${toDelete.length}`);
