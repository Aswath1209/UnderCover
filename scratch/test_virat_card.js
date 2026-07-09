const fs = require('fs');
const path = require('path');

let cardFilesCache = [];

function refreshCardFilesCache() {
  try {
    const dir = path.join(__dirname, '..', 'assets', 'cards');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cardFilesCache = fs.readdirSync(dir);
  } catch (e) {
    console.error("Error reading cards directory:", e);
  }
}
refreshCardFilesCache();

function findPreexistingCard(playerName) {
  const target = playerName.toLowerCase().replace(/[\s_]+/g, '');
  const matchedFile = cardFilesCache.find(f => f.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[\s_]+/g, '') === target);
  if (matchedFile) {
    return path.join(__dirname, '..', 'assets', 'cards', matchedFile);
  }
  return null;
}

const player = {
  id: "some-id",
  name: "Virat Kohli",
  ovr: 96,
  batting_rating: 97,
  bowling_rating: 12
};

const existing = findPreexistingCard(player.name);
console.log(`findPreexistingCard: ${existing}`);

if (existing) {
  console.log("SUCCESS: Using pre-existing card:", existing);
} else {
  console.log("GENERATING NEW CARD for", player.name);
}
