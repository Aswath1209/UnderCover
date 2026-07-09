/**
 * Viv Richards Player Card Generator
 * Uses pcardTemplate.jpeg as the base and composites player image + stats
 */

const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs   = require('fs');
const path = require('path');

// ── Paths ──────────────────────────────────────────────────────────────────────
const TEMPLATE_PATH = path.join('/home/home/Downloads', 'pcardTemplate.jpeg');
const PLAYER_IMG    = path.join('/home/home/.gemini/antigravity/brain/87580fb2-94c8-4f4d-867d-34388482d1b0', 'viv_richards_cutout_1781876543709.png');
const OUTPUT_PATH   = path.join(__dirname, '..', 'assets', 'players', 'viv_richards_card.png');

// ── Player data ────────────────────────────────────────────────────────────────
const PLAYER = {
  name:    'VIV RICHARDS',
  batting: 97,
  bowling: 32,
  ovr:     97,
};

async function generateCard() {
  // Load template to get its natural dimensions
  const template = await loadImage(TEMPLATE_PATH);
  const W = template.width;
  const H = template.height;

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // ── 1. Draw base template ──────────────────────────────────────────────────
  ctx.drawImage(template, 0, 0, W, H);

  // ── 2. Player image in the upper zone ─────────────────────────────────────
  // Template analysis (930×1240 approx):
  //   Upper player zone: from ~y=80 to ~y=820  (name bar starts ~820)
  //   Name bar:          from ~y=820 to ~y=920
  //   Stats panel:       from ~y=930 to ~y=1200
  const playerZoneTop  = 60;
  const playerZoneBot  = Math.floor(H * 0.655); // just above name bar
  const playerZoneH    = playerZoneBot - playerZoneTop;
  const playerZoneW    = W;

  try {
    const playerImg = await loadImage(PLAYER_IMG);

    // Scale to fill the zone maintaining aspect, anchor to bottom
    const scale = Math.max(playerZoneW / playerImg.width, playerZoneH / playerImg.height) * 0.95;
    const dw    = playerImg.width  * scale;
    const dh    = playerImg.height * scale;
    const dx    = (W - dw) / 2;
    // Anchor player bottom to zone bottom so feet sit at the name bar
    const dy    = playerZoneBot - dh + 30;

    // Clip to upper zone so player doesn't bleed into name/stats
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, playerZoneTop, W, playerZoneH);
    ctx.clip();

    ctx.drawImage(playerImg, dx, dy, dw, dh);

    // Soft bottom fade to blend into name bar
    const fade = ctx.createLinearGradient(0, playerZoneBot - playerZoneH * 0.18, 0, playerZoneBot);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, playerZoneBot - playerZoneH * 0.18, W, playerZoneH * 0.18);

    ctx.restore();
  } catch (e) {
    console.warn('⚠️  Player image load failed:', e.message);
  }

  // ── 3. Name bar ───────────────────────────────────────────────────────────
  // The template has a wide horizontal bar around y=820–910
  // We just draw text over it — the bar graphic is already on the template
  const nameBarCY = Math.floor(H * 0.715); // vertical center of name bar
  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  // Outer glow
  ctx.shadowColor  = '#FF2200';
  ctx.shadowBlur   = 18;
  ctx.fillStyle    = '#FFFFFF';
  ctx.font         = `bold ${Math.floor(W * 0.088)}px "Arial Black", Arial`;
  ctx.fillText(PLAYER.name, W / 2, nameBarCY);
  ctx.shadowBlur   = 0;
  ctx.restore();

  // ── 4. Bottom stats ───────────────────────────────────────────────────────
  // Layout: [BATTING box | CENTER circle | BOWLING box]
  // Template bottom section starts ~y=935, ends ~y=1180
  const statsTop  = Math.floor(H * 0.755);
  const statsH    = Math.floor(H * 0.185);
  const statsCY   = statsTop + statsH * 0.38; // center of the number area

  const leftCX    = W * 0.22;   // batting box center
  const rightCX   = W * 0.78;   // bowling box center
  const centerCX  = W / 2;      // OVR circle center

  // ── Batting (left) ─────────────────────────────────────────────────────────
  drawStat(ctx, leftCX, statsCY, String(PLAYER.batting), 'BATTING', W);

  // ── OVR (center circle) ────────────────────────────────────────────────────
  const ovrNumSize = Math.floor(W * 0.13);
  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor  = '#FFD700';
  ctx.shadowBlur   = 20;
  const goldGrad   = ctx.createLinearGradient(centerCX - 60, statsCY - 40, centerCX + 60, statsCY + 20);
  goldGrad.addColorStop(0, '#FFEC72');
  goldGrad.addColorStop(0.5, '#FFD700');
  goldGrad.addColorStop(1, '#B8860B');
  ctx.fillStyle    = goldGrad;
  ctx.font         = `bold ${ovrNumSize}px "Arial Black", Arial`;
  ctx.fillText(String(PLAYER.ovr), centerCX, statsCY - 10);
  ctx.shadowBlur   = 0;

  // OVR label
  ctx.shadowColor  = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur   = 4;
  ctx.fillStyle    = '#FFD700';
  ctx.font         = `bold ${Math.floor(W * 0.038)}px Arial`;
  ctx.fillText('OVR', centerCX, statsCY + ovrNumSize * 0.58);
  ctx.shadowBlur   = 0;
  ctx.restore();

  // ── Bowling (right) ────────────────────────────────────────────────────────
  drawStat(ctx, rightCX, statsCY, String(PLAYER.bowling), 'BOWLING', W);

  // ── 5. Save ────────────────────────────────────────────────────────────────
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(OUTPUT_PATH, buffer);
  console.log(`✅ Card saved → ${OUTPUT_PATH}`);
  console.log(`   Size: ${W}×${H}px  |  ${(buffer.length / 1024).toFixed(1)} KB`);
}

function drawStat(ctx, cx, cy, value, label, W) {
  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  const numSize = Math.floor(W * 0.115);

  // Red glow number
  ctx.shadowColor  = '#FF2200';
  ctx.shadowBlur   = 16;
  ctx.fillStyle    = '#FFFFFF';
  ctx.font         = `bold ${numSize}px "Arial Black", Arial`;
  ctx.fillText(value, cx, cy - 8);
  ctx.shadowBlur   = 0;

  // Label (already on template as "BATTING"/"BOWLING" text banners,
  // but we overdraw to ensure correct values are visible)
  ctx.fillStyle    = 'rgba(255,255,255,0.0)'; // transparent — template already has labels
  ctx.font         = `bold ${Math.floor(W * 0.035)}px Arial`;
  ctx.fillText(label, cx, cy + numSize * 0.6);

  ctx.restore();
}

generateCard().catch(console.error);
