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

console.log("Parsing values from SQL dump...");

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
console.log(`Parsed ${parsedRecords.length} records.`);

const standardPrices = {
  64: 400,
  65: 450,
  66: 500,
  67: 550,
  68: 600,
  69: 650,
  70: 700,
  71: 750,
  72: 800,
  73: 850,
  74: 900,
  75: 1100,
  76: 3250,
  77: 6755,
  78: 10250,
  79: 14600,
  80: 31445,
  81: 56420,
  82: 84750,
  83: 137650,
  84: 214750,
  85: 335250,
  86: 460550,
  87: 545250,
  88: 650575,
  89: 786750,
  90: 960500,
  91: 1200000,
  92: 1505000,
  93: 1840650,
  94: 2110725,
  95: 2605500,
  96: 3050000,
  97: 3500000,
  98: 4155500,
  99: 4525000
};

// Map to players with price corrections applied
const players = parsedRecords.map(r => {
  const ovr = r[6] === 'null' ? null : parseInt(r[6]);
  let price = r[8] === 'null' ? null : parseInt(r[8]);
  
  // Apply price correction
  if (ovr !== null && price !== null) {
    const expected = standardPrices[ovr];
    if (expected !== undefined && price < expected) {
      price = expected;
    }
  }

  return {
    id: r[0],
    name: r[1],
    country: r[2] === 'null' ? null : r[2],
    role: r[3] === 'null' ? null : r[3],
    batting_rating: r[4] === 'null' ? null : parseInt(r[4]),
    bowling_rating: r[5] === 'null' ? null : parseInt(r[5]),
    ovr: ovr,
    bowler_type: r[7] === 'null' ? null : r[7],
    buy_price: price,
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

// Apply de-duplication rules
const toKeep = [];
const toDelete = [];

for (const [name, list] of Object.entries(nameMap)) {
  if (list.length > 1) {
    list.sort((a, b) => {
      if ((b.ovr || 0) !== (a.ovr || 0)) {
        return (b.ovr || 0) - (a.ovr || 0);
      }
      if ((b.buy_price || 0) !== (a.buy_price || 0)) {
        return (b.buy_price || 0) - (a.buy_price || 0);
      }
      return a.id.localeCompare(b.id);
    });
    toKeep.push(list[0]);
    toDelete.push(...list.slice(1));
  } else {
    toKeep.push(list[0]);
  }
}

console.log(`Deduplication: keeping ${toKeep.length} records, removing ${toDelete.length} duplicates.`);

// Format SQL value string helper
function escapeString(val) {
  if (val === null || val === undefined) return 'null';
  return `'${val.replace(/'/g, "''")}'`;
}

function formatValue(val) {
  if (val === null || val === undefined) return 'null';
  return val;
}

// Generate new VALUES SQL
const formattedValues = toKeep.map(p => {
  return `(${escapeString(p.id)}, ${escapeString(p.name)}, ${escapeString(p.country)}, ${escapeString(p.role)}, ${formatValue(p.batting_rating)}, ${formatValue(p.bowling_rating)}, ${formatValue(p.ovr)}, ${escapeString(p.bowler_type)}, ${formatValue(p.buy_price)}, ${escapeString(p.image_url)}, ${escapeString(p.created_at)}, ${escapeString(p.tier)}, ${escapeString(p.batting_archetype)}, ${escapeString(p.bowling_archetype)})`;
}).join(', ');

lines[insertLineIdx] = `${insertPrefix}${formattedValues};`;

// Write back to the SQL file
fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log(`Successfully updated and saved ${filePath}!`);
