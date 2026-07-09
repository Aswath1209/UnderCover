/**
 * Cricket Trading Card Generator — Undercover Bot
 * Usage: node scripts/generateCard.js [output_path]
 * Generates a premium trading card for Glenn McGrath by default.
 */

const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

// Wrapper to match canvas API
function registerFont(filePath, { family }) {
  try { GlobalFonts.registerFromPath(filePath, family); } catch(e) {}
}
const fs = require('fs');
const path = require('path');

// Register local fonts
const fontsDir = path.join(__dirname, '..', 'assets', 'fonts');
try {
  registerFont(path.join(fontsDir, 'BebasNeue-Regular.ttf'), { family: 'BebasNeue' });
  registerFont(path.join(fontsDir, 'Saira-BoldItalic.ttf'),  { family: 'Saira', weight: 'bold',   style: 'italic' });
  registerFont(path.join(fontsDir, 'Saira-SemiBoldItalic.ttf'), { family: 'Saira', weight: '600', style: 'italic' });
} catch (e) { /* fonts optional */ }

// ─── Player data ───────────────────────────────────────────────────────────────
const PLAYER = {
  name:        'Glenn McGrath',
  firstName:   'GLENN',
  lastName:    'McGRATH',
  country:     'Australia',
  countryFlag: '🇦🇺',
  role:        'bowler',
  bowlingStyle:'fast',
  ovr:         99,   // bowling rating (primary)
  bat:         38,   // batting rating
  overallOvr:  99,
  tier:        'Legendary',
  specialTag:  'STRIKE BOWLER',
};

// ─── Card dimensions ────────────────────────────────────────────────────────────
const W = 540;
const H = 800;

// ─── Colour palette ─────────────────────────────────────────────────────────────
const COLORS = {
  bg:          '#0a0d1a',
  bgGrad1:     '#0d1530',
  bgGrad2:     '#040710',
  gold:        '#FFD700',
  goldDark:    '#B8860B',
  goldLight:   '#FFEC72',
  silver:      '#C0C0C0',
  red:         '#C0392B',
  redGlow:     '#E74C3C',
  white:       '#FFFFFF',
  textHint:    '#8899BB',
  panel:       'rgba(255,255,255,0.06)',
  border:      'rgba(255,215,0,0.85)',
  legendary:   '#FF6B35',
  divider:     'rgba(255,215,0,0.35)',
};

// ─── Helpers ────────────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawGlow(ctx, x, y, r, color, alpha = 0.35) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color.replace(')', `, ${alpha})`).replace('rgb', 'rgba'));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ─── Main generator ─────────────────────────────────────────────────────────────
async function generateCard(player, outputPath) {
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // ── 1. Background ──────────────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bgGrad.addColorStop(0, '#0d1530');
  bgGrad.addColorStop(0.5, '#080d20');
  bgGrad.addColorStop(1, '#040610');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle diagonal grid lines
  ctx.save();
  ctx.strokeStyle = 'rgba(255,215,0,0.04)';
  ctx.lineWidth = 1;
  for (let i = -H; i < W + H; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
  }
  ctx.restore();

  // ── 2. Outer card border (gold foil) ──────────────────────────────────────
  // Shadow
  ctx.shadowColor = COLORS.gold;
  ctx.shadowBlur  = 22;
  roundRect(ctx, 8, 8, W - 16, H - 16, 22);
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth   = 3;
  ctx.stroke();
  ctx.shadowBlur  = 0;

  // Inner border
  roundRect(ctx, 13, 13, W - 26, H - 26, 18);
  ctx.strokeStyle = 'rgba(255,215,0,0.25)';
  ctx.lineWidth   = 1;
  ctx.stroke();

  // ── 3. Tier badge (top-left) ───────────────────────────────────────────────
  const tierColor = COLORS.legendary; // orange for Legendary
  const tierGrad  = ctx.createLinearGradient(22, 22, 150, 22);
  tierGrad.addColorStop(0, tierColor);
  tierGrad.addColorStop(1, '#8B1A00');
  roundRect(ctx, 22, 22, 130, 32, 8);
  ctx.fillStyle = tierGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth   = 1;
  ctx.stroke();

  ctx.fillStyle = COLORS.white;
  ctx.font      = 'bold 13px BebasNeue, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('★ LEGENDARY', 87, 42);

  // ── 4. Country flag + name (top-right) ────────────────────────────────────
  ctx.fillStyle  = COLORS.textHint;
  ctx.font       = '13px Arial';
  ctx.textAlign  = 'right';
  ctx.fillText(`${player.countryFlag}  ${player.country.toUpperCase()}`, W - 24, 42);

  // ── 5. Central glow spotlight ──────────────────────────────────────────────
  // Gold warm spotlight behind silhouette area
  const spotlight = ctx.createRadialGradient(W / 2, 295, 10, W / 2, 295, 210);
  spotlight.addColorStop(0, 'rgba(255, 190, 30, 0.28)');
  spotlight.addColorStop(0.5, 'rgba(180, 100, 0, 0.12)');
  spotlight.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = spotlight;
  ctx.fillRect(0, 60, W, 470);

  // ── 6. Player image (or archetype silhouette) ──────────────────────────────
  const imgName    = player.name.trim().replace(/\s+/g, '_').toLowerCase() + '.jpg';
  const imgPath    = path.join(__dirname, '..', 'assets', 'players', imgName);
  const archetypes = path.join(__dirname, '..', 'assets', 'players', 'archetypes');

  let playerImg = null;
  try {
    if (fs.existsSync(imgPath) && fs.statSync(imgPath).size > 0) {
      playerImg = await loadImage(imgPath);
    } else {
      // Try archetype silhouette
      const archFile = path.join(archetypes, `${player.bowlingStyle || player.role}.png`);
      if (fs.existsSync(archFile)) playerImg = await loadImage(archFile);
    }
  } catch (e) { /* no image */ }

  const imgAreaTop  = 68;
  const imgAreaH    = 400;
  const imgAreaW    = W - 60;
  const imgAreaX    = 30;

  if (playerImg) {
    // Clip to card area
    ctx.save();
    roundRect(ctx, imgAreaX, imgAreaTop, imgAreaW, imgAreaH, 14);
    ctx.clip();

    // Draw with a bottom fade
    const scale  = Math.max(imgAreaW / playerImg.width, imgAreaH / playerImg.height);
    const dw     = playerImg.width  * scale;
    const dh     = playerImg.height * scale;
    const dx     = imgAreaX + (imgAreaW - dw) / 2;
    const dy     = imgAreaTop + (imgAreaH - dh) / 2 - 20;
    ctx.drawImage(playerImg, dx, dy, dw, dh);

    // Bottom gradient fade so stats panel looks clean
    const fade = ctx.createLinearGradient(0, imgAreaTop + imgAreaH * 0.55, 0, imgAreaTop + imgAreaH);
    fade.addColorStop(0, 'rgba(10,13,26,0)');
    fade.addColorStop(1, 'rgba(10,13,26,0.97)');
    ctx.fillStyle = fade;
    ctx.fillRect(imgAreaX, imgAreaTop, imgAreaW, imgAreaH);
    ctx.restore();
  } else {
    // Draw a stylized "no image" silhouette
    // Fast bowler pose via simple shapes
    ctx.save();
    ctx.fillStyle = 'rgba(255,215,0,0.07)';
    ctx.fillRect(imgAreaX, imgAreaTop, imgAreaW, imgAreaH);

    // Silhouette (simplified body)
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    // Head
    ctx.beginPath();
    ctx.arc(W / 2, 160, 38, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.beginPath();
    ctx.moveTo(W / 2 - 40, 200);
    ctx.lineTo(W / 2 + 40, 200);
    ctx.lineTo(W / 2 + 55, 360);
    ctx.lineTo(W / 2 - 55, 360);
    ctx.closePath();
    ctx.fill();
    // Raised arm
    ctx.beginPath();
    ctx.moveTo(W / 2 + 38, 210);
    ctx.lineTo(W / 2 + 110, 130);
    ctx.lineWidth = 22;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.stroke();
    // Ball circle at top of arm
    ctx.beginPath();
    ctx.arc(W / 2 + 115, 125, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,180,0,0.2)';
    ctx.fill();
    ctx.restore();
  }

  // ── 7. Primary OVR number (bowling rating — huge gold) ────────────────────
  // Large glow behind the number
  const ovrX = W / 2;
  const ovrY = 480;

  ctx.save();
  ctx.shadowColor = COLORS.gold;
  ctx.shadowBlur  = 40;
  const ovrGrad  = ctx.createLinearGradient(ovrX - 80, ovrY - 80, ovrX + 80, ovrY + 10);
  ovrGrad.addColorStop(0, COLORS.goldLight);
  ovrGrad.addColorStop(0.5, COLORS.gold);
  ovrGrad.addColorStop(1, COLORS.goldDark);
  ctx.fillStyle  = ovrGrad;
  ctx.font       = 'bold italic 110px BebasNeue, Arial Black';
  ctx.textAlign  = 'center';
  ctx.fillText(String(player.ovr), ovrX, ovrY);
  ctx.shadowBlur  = 0;
  ctx.restore();

  // "OVR" label under number
  ctx.fillStyle   = COLORS.textHint;
  ctx.font        = '700 14px BebasNeue, Arial';
  ctx.textAlign   = 'center';
  ctx.letterSpacing = '4px';
  ctx.fillText('BOWLING RATING', ovrX, ovrY + 14);

  // ── 8. Player name ─────────────────────────────────────────────────────────
  const nameY = 535;
  // First name (silver)
  ctx.fillStyle  = COLORS.silver;
  ctx.font       = '600 italic 32px Saira, Arial';
  ctx.textAlign  = 'center';
  ctx.fillText(player.firstName, W / 2, nameY);

  // Last name (white, larger)
  ctx.shadowColor = 'rgba(255,255,255,0.3)';
  ctx.shadowBlur  = 8;
  ctx.fillStyle  = COLORS.white;
  ctx.font       = 'bold italic 54px BebasNeue, Arial Black';
  ctx.textAlign  = 'center';
  ctx.fillText(player.lastName, W / 2, nameY + 50);
  ctx.shadowBlur = 0;

  // ── 9. Role badge (below name) ─────────────────────────────────────────────
  const badgeLabel = player.bowlingStyle === 'fast'     ? '⚡ FAST BOWLER'
                   : player.bowlingStyle === 'off_spin'  ? '🔄 OFF SPIN'
                   : player.bowlingStyle === 'leg_spin'  ? '🌀 LEG SPIN'
                   : player.role === 'batsman'           ? '🏏 BATSMAN'
                   : player.role === 'wicket_keeper'     ? '🧤 WICKET KEEPER'
                   : player.role === 'all_rounder'       ? '⚔ ALL ROUNDER'
                   : '🏏 PLAYER';

  const badgeW   = 180;
  const badgeH   = 34;
  const badgeX   = W / 2 - badgeW / 2;
  const badgeY   = nameY + 68;

  const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY);
  badgeGrad.addColorStop(0, '#8B0000');
  badgeGrad.addColorStop(1, '#C0392B');
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 6);
  ctx.fillStyle   = badgeGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth   = 1;
  ctx.stroke();

  ctx.fillStyle   = COLORS.white;
  ctx.font        = 'bold 14px BebasNeue, Arial';
  ctx.textAlign   = 'center';
  ctx.fillText(badgeLabel, W / 2, badgeY + 22);

  // ── 10. Stats bar ──────────────────────────────────────────────────────────
  const barY = badgeY + 54;
  const barH = 78;
  const barX = 24;
  const barW = W - 48;

  // Panel background
  roundRect(ctx, barX, barY, barW, barH, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fill();
  ctx.strokeStyle = COLORS.divider;
  ctx.lineWidth   = 1;
  ctx.stroke();

  // Three columns
  const col = barW / 3;
  const stats = [
    { label: 'BOWLING', value: String(player.ovr),       color: COLORS.gold },
    { label: 'BATTING', value: String(player.bat),        color: COLORS.silver },
    { label: 'TIER',    value: player.tier.toUpperCase(), color: COLORS.legendary },
  ];

  stats.forEach((s, i) => {
    const cx = barX + col * i + col / 2;
    const cy = barY + barH / 2;

    // Dividers
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(barX + col * i, barY + 12);
      ctx.lineTo(barX + col * i, barY + barH - 12);
      ctx.strokeStyle = COLORS.divider;
      ctx.lineWidth   = 1;
      ctx.stroke();
    }

    // Value
    ctx.fillStyle   = s.color;
    ctx.font        = `bold ${s.label === 'TIER' ? '18px' : '28px'} BebasNeue, Arial Black`;
    ctx.textAlign   = 'center';
    ctx.fillText(s.value, cx, cy + 6);

    // Label
    ctx.fillStyle   = COLORS.textHint;
    ctx.font        = '11px Arial';
    ctx.textAlign   = 'center';
    ctx.fillText(s.label, cx, cy + 24);
  });

  // ── 11. Logo + footer ──────────────────────────────────────────────────────
  const footerY = barY + barH + 14;
  const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');

  ctx.fillStyle = COLORS.textHint;
  ctx.font      = '11px Arial';
  ctx.textAlign = 'center';

  try {
    if (fs.existsSync(logoPath)) {
      const logo = await loadImage(logoPath);
      const lh   = 22;
      const lw   = (logo.width / logo.height) * lh;
      ctx.drawImage(logo, W / 2 - lw / 2 - 42, footerY, lw, lh);
      ctx.fillText('UNDERCOVER BOT', W / 2 + 18, footerY + 15);
    } else {
      ctx.fillText('🎭 UNDERCOVER BOT', W / 2, footerY + 12);
    }
  } catch (e) {
    ctx.fillText('🎭 UNDERCOVER BOT', W / 2, footerY + 12);
  }

  // ── 12. Corner serial number (collector card feel) ────────────────────────
  ctx.fillStyle = 'rgba(255,215,0,0.3)';
  ctx.font      = '10px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('#UC-2025', W - 28, H - 20);

  // ── Save ───────────────────────────────────────────────────────────────────
  const out    = outputPath || path.join(__dirname, '..', 'output_card.png');
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(out, buffer);
  console.log(`✅ Card saved to: ${out}`);
  return out;
}

// ─── Run ───────────────────────────────────────────────────────────────────────
generateCard(PLAYER, process.argv[2]).catch(console.error);
