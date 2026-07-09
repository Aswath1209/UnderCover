const axios = require('axios');
const fs = require('fs');

async function run() {
  const url = 'https://en.wikipedia.org/wiki/2026_Chennai_Super_Kings_season';
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    fs.writeFileSync('scratch/csk_2026.html', res.data);
    console.log("Downloaded!");
  } catch (err) {
    console.error("Failed:", err);
  }
}

run();
