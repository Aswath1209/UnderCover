const axios = require('axios');
const cheerio = require('cheerio');

async function getBowlingStyleSearch(playerName) {
  const headers = { 'User-Agent': 'UndercoverBot/1.0 (test@test.com)' };
  
  try {
    // 1. Search Wikipedia for "<playerName> cricket" to get correct article title
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(playerName + ' cricket')}&format=json&origin=*`;
    const searchRes = await axios.get(searchUrl, { headers });
    
    const searchResults = searchRes.data?.query?.search;
    if (!searchResults || searchResults.length === 0) {
      return null;
    }

    const title = searchResults[0].title;
    
    // 2. Fetch page HTML
    const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    const pageRes = await axios.get(pageUrl, { headers, timeout: 10000 });
    const html = pageRes.data;

    const $ = cheerio.load(html);
    const infobox = $('.infobox.vcard');
    if (!infobox.length) return null;
    
    let bowlingStyle = null;
    infobox.find('tr').each((i, row) => {
      const th = $(row).find('th').first().text().trim().toLowerCase();
      const td = $(row).find('td').first().text().trim();
      if ((th === 'bowling style' || th === 'bowling') && td) {
        bowlingStyle = td;
      }
    });
    
    return { title, bowlingStyle };
  } catch (err) {
    return null;
  }
}

async function run() {
  const testPlayers = ['Abrar Ahmed', 'Radha Yadav', 'Poonam Yadav', 'Tom Hartley', 'Virat Kohli', 'Jasprit Bumrah', 'Wanindu Hasaranga', 'Rashid Khan', 'Travis Head', 'Moeen Ali', 'Glenn Maxwell', 'Steve Smith', 'Kane Williamson'];
  for (const name of testPlayers) {
    const res = await getBowlingStyleSearch(name);
    console.log(`Player: ${name} | Title: ${res?.title} | Style: ${res?.bowlingStyle}`);
    await new Promise(r => setTimeout(r, 500));
  }
}

run();
