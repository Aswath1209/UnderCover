const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function run() {
  console.log("Fetching pristine SQL file from git...");
  const sqlContent = execSync('git show HEAD:data/cricketplayers.sql', { encoding: 'utf8' });
  const lines = sqlContent.split('\n');

  const insertPrefix = 'INSERT INTO "public"."cricketplayers" ("id", "name", "country", "role", "batting_rating", "bowling_rating", "ovr", "bowler_type", "buy_price", "image_url", "created_at", "tier", "batting_archetype", "bowling_archetype") VALUES ';

  const insertLineIdx = lines.findIndex(l => l.startsWith(insertPrefix));
  if (insertLineIdx === -1) {
    console.error("Could not find the INSERT line.");
    process.exit(1);
  }

  const insertLine = lines[insertLineIdx];
  const valuesPart = insertLine.substring(insertPrefix.length).trim();
  const valuesStr = valuesPart.endsWith(';') ? valuesPart.slice(0, -1) : valuesPart;

  console.log("Parsing original SQL values...");

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
  console.log(`Parsed ${parsedRecords.length} original records.`);

  const legacyPrices = {};
  parsedRecords.forEach(r => {
    const id = r[0];
    const price = r[8] === 'null' ? null : parseInt(r[8]);
    if (price !== null) {
      legacyPrices[id] = price;
    }
  });

  const outputPath = path.join(__dirname, '..', 'db', 'legacyPrices.json');
  fs.writeFileSync(outputPath, JSON.stringify(legacyPrices, null, 2), 'utf8');
  console.log(`Successfully wrote ${Object.keys(legacyPrices).length} prices to ${outputPath}`);
}

run();
