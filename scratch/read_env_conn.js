require('dotenv').config();
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  console.log("Lines in .env:");
  content.split('\n').forEach(line => {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) return;
    const parts = clean.split('=');
    const key = parts[0];
    console.log(`  Key: ${key}`);
  });
} else {
  console.log(".env not found");
}
