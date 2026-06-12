const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { supabase } = require('../db/supabase');

const sqlPath = path.join(__dirname, '..', 'data', 'cricketplayers.sql');
const cachePath = path.join(__dirname, 'bowling_styles_cache.json');

// 1. Read and parse the cache
if (!fs.existsSync(cachePath)) {
  console.error("Cache file does not exist yet.");
  process.exit(1);
}
const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));

// 2. Read the SQL file
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

// SQL values parser
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

console.log(`Loaded ${players.length} players from SQL file.`);

// 3. Match with cache and apply updates in-memory
const updates = [];
const updatedPlayers = players.map(p => {
  const cached = cache[p.name];
  if (cached && !cached.error && cached.classified_bowler_type) {
    if (p.bowler_type !== cached.classified_bowler_type) {
      updates.push({
        id: p.id,
        name: p.name,
        ovr: p.ovr,
        old: p.bowler_type,
        new: cached.classified_bowler_type,
        styleText: cached.styleText
      });
      return {
        ...p,
        bowler_type: cached.classified_bowler_type
      };
    }
  }
  return p;
});

if (updates.length === 0) {
  console.log("No bowler type updates found in cache to apply.");
  process.exit(0);
}

console.log(`Found ${updates.length} updates to apply.`);

// 4. Overwrite data/cricketplayers.sql
console.log("Writing updates to local data/cricketplayers.sql file...");
const sqlRows = updatedPlayers.map(p => {
  const fields = [
    `'${p.id}'`,
    `'${p.name.replace(/'/g, "''")}'`,
    p.country ? `'${p.country.replace(/'/g, "''")}'` : 'null',
    p.role ? `'${p.role.replace(/'/g, "''")}'` : 'null',
    p.batting_rating !== null ? p.batting_rating : 'null',
    p.bowling_rating !== null ? p.bowling_rating : 'null',
    p.ovr !== null ? p.ovr : 'null',
    p.bowler_type ? `'${p.bowler_type}'` : 'null',
    p.buy_price !== null ? p.buy_price : 'null',
    p.image_url ? `'${p.image_url.replace(/'/g, "''")}'` : 'null',
    p.created_at ? `'${p.created_at}'` : 'null',
    p.tier ? `'${p.tier}'` : 'null',
    p.batting_archetype ? `'${p.batting_archetype}'` : 'null',
    p.bowling_archetype ? `'${p.bowling_archetype}'` : 'null'
  ];
  return `(${fields.join(', ')})`;
});

const newInsertLine = insertPrefix + sqlRows.join(',\n  ') + ';';

// Find where the old insert statement ends in the lines array
let insertEndIdx = insertStartIdx;
for (let i = insertStartIdx; i < lines.length; i++) {
  if (lines[i].includes(';')) {
    insertEndIdx = i;
    break;
  }
}

// Replace the entire range of the old insert statement with the new one
lines.splice(insertStartIdx, insertEndIdx - insertStartIdx + 1, newInsertLine);
fs.writeFileSync(sqlPath, lines.join('\n'));
console.log("Local SQL file successfully updated!");

// 5. Update Supabase database
async function updateDatabase() {
  if (!supabase) {
    console.log("Supabase client is disabled. Skipping database updates.");
    return;
  }
  
  console.log(`Applying ${updates.length} updates to Supabase db...`);
  
  for (let i = 0; i < updates.length; i++) {
    const upd = updates[i];
    console.log(`[${i+1}/${updates.length}] Updating ${upd.name} (${upd.ovr} OVR): ${upd.old} -> ${upd.new} (style: "${upd.styleText}")`);
    
    const { error } = await supabase
      .from('cricketplayers')
      .update({ bowler_type: upd.new })
      .eq('id', upd.id);
      
    if (error) {
      console.error(`  Error updating ${upd.name}:`, error.message);
    }
  }
  
  console.log("Database updates complete!");
}

updateDatabase().catch(console.error);
