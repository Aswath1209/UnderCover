const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

// Paths
const sqlPath = path.join(__dirname, '..', 'data', 'cricketplayers.sql');
const cachePath = path.join(__dirname, 'bowling_styles_cache.json');

// Helper to parse SQL
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

// Load cache
let cache = {};
if (fs.existsSync(cachePath)) {
  try {
    cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    console.log(`Loaded ${Object.keys(cache).length} cached player styles.`);
  } catch (e) {
    console.error("Error reading cache file, starting fresh.");
  }
}

// Scrape helper
async function fetchBowlingStyle(playerName) {
  const headers = { 'User-Agent': 'UndercoverBot/1.0 (test@test.com)' };
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(playerName + ' cricket')}&format=json&origin=*`;
    const searchRes = await axios.get(searchUrl, { headers, timeout: 5000 });
    
    const searchResults = searchRes.data?.query?.search;
    if (!searchResults || searchResults.length === 0) {
      return { styleText: null, sourceTitle: null };
    }

    // Try to find a search result that matches the player's name parts closely
    let selectedResult = searchResults[0];
    const nameParts = playerName.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
    for (const res of searchResults.slice(0, 5)) {
      const titleLower = res.title.toLowerCase();
      const allPartsMatch = nameParts.every(part => titleLower.includes(part));
      if (allPartsMatch) {
        selectedResult = res;
        break;
      }
    }

    const title = selectedResult.title;
    const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    const pageRes = await axios.get(pageUrl, { headers, timeout: 8000 });
    const html = pageRes.data;

    const $ = cheerio.load(html);
    const infobox = $('.infobox.vcard');
    if (!infobox.length) return { styleText: null, sourceTitle: title };
    
    let bowlingStyle = null;
    infobox.find('tr').each((i, row) => {
      const th = $(row).find('th').first().text().trim().toLowerCase();
      const td = $(row).find('td').first().text().trim();
      if ((th === 'bowling style' || th === 'bowling') && td) {
        bowlingStyle = td;
      }
    });
    
    return { styleText: bowlingStyle, sourceTitle: title };
  } catch (err) {
    throw err;
  }
}

// Classifier function
function classifyBowlingStyle(styleText) {
  if (!styleText) return null;
  const text = styleText.toLowerCase();
  
  if (text.includes('leg spin') || 
      text.includes('leg-spin') || 
      text.includes('leg break') || 
      text.includes('legbreak') || 
      text.includes('googly') || 
      text.includes('unorthodox') || 
      text.includes('wrist spin') || 
      text.includes('wrist-spin')) {
    return 'leg_spin';
  }
  
  if (text.includes('off spin') || 
      text.includes('off-spin') || 
      text.includes('off break') || 
      text.includes('offbreak') || 
      text.includes('orthodox') || 
      text.includes('finger spin') || 
      text.includes('finger-spin') || 
      text.includes('doosra') || 
      text.includes('carrom')) {
    return 'off_spin';
  }
  
  if (text.includes('fast') || 
      text.includes('medium') || 
      text.includes('seam') || 
      text.includes('swing') || 
      text.includes('pace') || 
      text.includes('cutter')) {
    return 'fast';
  }
  
  if (text.includes('spin')) {
    return 'off_spin';
  }
  
  return null;
}

async function run() {
  const players = getSqlPlayers();
  console.log(`Loaded ${players.length} players from SQL file.`);

  // Filter to bowlers, all_rounders, or those with bowling_rating >= 40
  const bowlingPlayers = players.filter(p => p.role === 'bowler' || p.role === 'all_rounder' || (p.bowling_rating && p.bowling_rating >= 40));
  console.log(`Found ${bowlingPlayers.length} players to check.`);

  let processedCount = 0;
  let errorCount = 0;
  let saveInterval = 20;

  // Let's run with concurrency 3 to respect rate limits
  const concurrencyLimit = 3;
  const queue = [...bowlingPlayers];

  console.log(`Starting scraping queue with concurrency ${concurrencyLimit}...`);

  async function worker() {
    while (queue.length > 0) {
      const player = queue.shift();
      if (!player) continue;

      if (cache[player.name]) {
        // Already in cache, skip
        continue;
      }

      // 1200ms delay between starting requests to respect rate limits
      await new Promise(r => setTimeout(r, Math.random() * 500 + 1000));

      try {
        const info = await fetchBowlingStyle(player.name);
        const classified = classifyBowlingStyle(info.styleText);
        
        cache[player.name] = {
          name: player.name,
          role: player.role,
          ovr: player.ovr,
          bowling_rating: player.bowling_rating,
          original_bowler_type: player.bowler_type,
          styleText: info.styleText,
          sourceTitle: info.sourceTitle,
          classified_bowler_type: classified,
          timestamp: new Date().toISOString()
        };

        processedCount++;
        
        if (processedCount % saveInterval === 0) {
          fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
          console.log(`Saved progress: ${processedCount} new players processed (Total cached: ${Object.keys(cache).length})`);
        }
      } catch (err) {
        errorCount++;
        console.error(`Error fetching ${player.name}: ${err.message}`);
        // If we hit 429 rate limit, put the player back on queue and sleep
        if (err.response && err.response.status === 429) {
          console.warn("Rate limit hit! Sleeping for 25 seconds...");
          queue.push(player);
          await new Promise(r => setTimeout(r, 25000));
        } else {
          // General errors: cache as null/error so we don't retry endlessly
          cache[player.name] = {
            name: player.name,
            error: err.message,
            timestamp: new Date().toISOString()
          };
        }
      }
    }
  }

  // Launch initial workers
  const workers = Array.from({ length: concurrencyLimit }, () => worker());
  await Promise.all(workers);

  // Final save
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  console.log(`Completed! Total cached players: ${Object.keys(cache).length}. Errors encountered: ${errorCount}`);

  // Analyze changes
  let corrections = 0;
  const playersToUpdate = [];
  
  for (const p of bowlingPlayers) {
    const cached = cache[p.name];
    if (cached && !cached.error && cached.classified_bowler_type) {
      if (p.bowler_type !== cached.classified_bowler_type) {
        corrections++;
        playersToUpdate.push({
          name: p.name,
          role: p.role,
          original: p.bowler_type,
          new: cached.classified_bowler_type,
          styleText: cached.styleText
        });
      }
    }
  }

  console.log(`\nAnalysis: ${corrections} players will have bowler type updated.`);
  console.log("Sample updates:", playersToUpdate.slice(0, 30));

  if (corrections > 0) {
    console.log("\nExecuting apply_bowler_updates.js to apply these updates...");
    const { execSync } = require('child_process');
    try {
      execSync('node scratch/apply_bowler_updates.js', { stdio: 'inherit' });
      console.log("Updates applied successfully!");
    } catch (e) {
      console.error("Failed to run updater script:", e.message);
    }
  }
}

run().catch(console.error);
