const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'cricketplayers.sql');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log(`File: ${filePath}`);
console.log(`Total lines: ${lines.length}`);
lines.forEach((line, idx) => {
  if (line.trim().length > 0) {
    console.log(`Line ${idx + 1} length: ${line.length} | Starts with: "${line.substring(0, 50)}..."`);
  }
});
