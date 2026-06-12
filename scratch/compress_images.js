// compress_images.js — One-time bandwidth optimization
// Resizes + recompresses player images that are oversized.
// Safe: only overwrites if the new file is smaller.

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PLAYERS_DIR = path.join(__dirname, '..', 'assets', 'players');
const SIZE_THRESHOLD = 80 * 1024; // only compress files > 80 KB
const TARGET_WIDTH = 400;
const TARGET_QUALITY = 75;

async function run() {
    const files = fs.readdirSync(PLAYERS_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png'));
    let totalSaved = 0;
    let compressed = 0;

    for (const file of files) {
        const filepath = path.join(PLAYERS_DIR, file);
        const stat = fs.statSync(filepath);
        if (stat.size <= SIZE_THRESHOLD) continue;

        const originalKB = Math.round(stat.size / 1024);
        try {
            const buffer = await sharp(filepath)
                .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
                .jpeg({ quality: TARGET_QUALITY, progressive: true })
                .toBuffer();

            if (buffer.length < stat.size) {
                const savedKB = Math.round((stat.size - buffer.length) / 1024);
                fs.writeFileSync(filepath, buffer);
                totalSaved += (stat.size - buffer.length);
                compressed++;
                console.log(`✅ ${file}: ${originalKB}KB → ${Math.round(buffer.length / 1024)}KB (saved ${savedKB}KB)`);
            } else {
                console.log(`⏭️  ${file}: already optimal (${originalKB}KB)`);
            }
        } catch (e) {
            console.error(`❌ Error compressing ${file}:`, e.message);
        }
    }

    console.log(`\n🎉 Done! Compressed ${compressed} files, saved ${Math.round(totalSaved / 1024)} KB total.`);
}

run().catch(console.error);
