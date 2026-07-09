const axios = require('axios');

async function run() {
  const url = 'https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:2026_Indian_Premier_League_seasons&cmlimit=50&format=json';
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const members = res.data.query.categorymembers;
    console.log("Category Members:");
    members.forEach(m => console.log(`- ${m.title} (Page ID: ${m.pageid})`));
  } catch (err) {
    console.error("Failed to query Wikipedia category:", err);
  }
}

run();
