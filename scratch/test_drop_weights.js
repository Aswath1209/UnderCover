const fs = require('fs');
const path = require('path');

function loadPlayers() {
  const sqlPath = path.join(__dirname, '..', 'data', 'cricketplayers.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  
  const lines = sqlContent.split('\n');
  const players = [];
  const regex = /\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,/i;
  
  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      players.push({
        id: match[1],
        name: match[2],
        ovr: parseInt(match[7])
      });
    }
  }
  return players;
}

const players = loadPlayers();
const K_values = [0.42, 0.35, 0.32, 0.30, 0.28, 0.25];

for (const K of K_values) {
  const MAX_OVR = 86;
  const pool = players.filter(p => p.ovr <= MAX_OVR);
  const weights = pool.map(p => Math.exp(-K * (p.ovr - 50)));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  
  let weightAbove76 = 0;
  let weightAbove80 = 0;
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].ovr >= 76) {
      weightAbove76 += weights[i];
    }
    if (pool[i].ovr >= 80) {
      weightAbove80 += weights[i];
    }
  }
  
  const percentAbove76 = (weightAbove76 / totalWeight) * 100;
  const percentAbove80 = (weightAbove80 / totalWeight) * 100;
  console.log(`K = ${K.toFixed(2)}: 76+ rate = ${percentAbove76.toFixed(2)}% | 80+ rate = ${percentAbove80.toFixed(2)}%`);
}
