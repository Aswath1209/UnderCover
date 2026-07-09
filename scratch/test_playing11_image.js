require('dotenv').config();
const sb = require('../db/supabase');
const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

// Register Lemon Milk font
try {
  GlobalFonts.registerFromPath(path.join(__dirname, '..', 'assets', 'fonts', 'LEMONMILK-BoldItalic.otf'), 'Lemon Milk');
} catch (e) {
  console.log("Font registration skipped or already registered:", e);
}

// Find pre-existing card
function findPreexistingCard(playerName) {
  if (!playerName) return null;
  const cardsDir = path.join(__dirname, '..', 'assets', 'cards');
  if (!fs.existsSync(cardsDir)) return null;

  const files = fs.readdirSync(cardsDir);
  const normalizedSearch = playerName.replace(/[\s_\-]/g, '').toLowerCase();

  const match = files.find(f => {
    const nameWithoutExt = path.parse(f).name;
    const normalizedName = nameWithoutExt.replace(/[\s_\-]/g, '').toLowerCase();
    return normalizedName === normalizedSearch;
  });

  if (match) {
    return path.join(cardsDir, match);
  }
  return null;
}

// Card generator
async function getOrGeneratePlayerCardPath(player) {
  const existingPath = findPreexistingCard(player.name);
  if (existingPath) {
    return existingPath;
  }

  const templatePath = path.join(__dirname, '..', 'assets', 'CricTemplate.jpeg');
  const template = await loadImage(templatePath);
  const width = template.width;
  const height = template.height;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(template, 0, 0, width, height);

  const name = player.name.toUpperCase();
  const batting = String(player.batting_rating || 0);
  const bowling = String(player.bowling_rating || 0);
  const ovr = String(player.ovr || 0);

  const battingBowlingSize = 110;
  const overallSize = battingBowlingSize * 0.9;
  const nameSize = battingBowlingSize * 0.6;

  const nameX = 542.5;
  const nameY = 1020;
  const battingX = 200;
  const battingY = 1225;
  const bowlingX = 860;
  const bowlingY = 1225;
  const ovrX = 542.5;
  const ovrY = 1253;

  function drawGradientText(text, x, y, fontSize) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${fontSize}px "Lemon Milk"`;

    const yStart = y - fontSize / 2;
    const yEnd = y + fontSize / 2;
    const grad = ctx.createLinearGradient(0, yStart, 0, yEnd);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#ff1a1a');

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(6, fontSize * 0.08);
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 2;
    ctx.strokeText(text, x, y);

    ctx.fillStyle = grad;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  drawGradientText(name, nameX, nameY, nameSize);
  drawGradientText(batting, battingX, battingY, battingBowlingSize);
  drawGradientText(bowling, bowlingX, bowlingY, battingBowlingSize);
  drawGradientText(ovr, ovrX, ovrY, overallSize);

  const outDir = path.join(__dirname, '..', 'scratch');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, `${player.id}_generated_card.png`);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

function drawRoundRect(ctx, x, y, width, height, radius) {
  if (typeof radius === 'number') {
    radius = { tl: radius, tr: radius, br: radius, bl: radius };
  } else {
    const defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
    radius = { ...defaultRadius, ...radius };
  }
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + width - radius.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
  ctx.lineTo(x + width, y + height - radius.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
  ctx.lineTo(x + radius.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
}

async function test() {
  const testUserId = 999999999;
  console.log("Setting up test squad for Playing XI rendering...");
  
  // Clean up
  await sb.supabase.from('user_owned_players').delete().eq('user_id', testUserId);

  try {
    // Fetch 11 sample players from db
    const { data: players, error } = await sb.supabase.from('cricketplayers').select('*').limit(11);
    if (error || !players || players.length < 11) {
      throw new Error("Could not fetch 11 players for test");
    }

    // Set Virat Kohli (or first player) as captain in mock test
    const captainPlayer = players[0];
    await sb.setCaptain(testUserId, captainPlayer.id, 'cricket');

    // Insert 11 players
    await sb.supabase.from('user_owned_players').insert(
      players.map((p, idx) => ({
        user_id: testUserId,
        player_id: p.id,
        sport: 'cricket',
        squad_order: idx + 1
      }))
    );

    // Fetch squad details
    const squad = await sb.getUserCricketTeam(testUserId);
    const xi = squad.slice(0, 11);
    const teamName = "Strikers XI";

    console.log("Generating Playing XI board image...");
    const width = 1200;
    const height = 980; // slightly taller to fit 225px tall cards
    const canvas = createCanvas(width, height);
    const ctxCanvas = canvas.getContext('2d');

    // 1. Draw Stadium Background
    try {
      const bgImg = await loadImage(path.join(__dirname, '..', 'assets', 'stadium_bg.png'));
      ctxCanvas.drawImage(bgImg, 0, 0, width, height);
    } catch (err) {
      console.log("Failed to load stadium background, using fallback gradient:", err);
      const bgGrad = ctxCanvas.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#0a0d1a');
      bgGrad.addColorStop(0.5, '#120f26');
      bgGrad.addColorStop(1, '#05060d');
      ctxCanvas.fillStyle = bgGrad;
      ctxCanvas.fillRect(0, 0, width, height);
    }

    // 2. Apply a dark atmospheric glass overlay
    ctxCanvas.fillStyle = 'rgba(11, 10, 26, 0.72)';
    ctxCanvas.fillRect(0, 0, width, height);

    // Draw premium cyber stadium grid overlay
    ctxCanvas.strokeStyle = 'rgba(0, 242, 254, 0.03)';
    ctxCanvas.lineWidth = 1;
    const gridSize = 60;
    for (let x = 0; x < width; x += gridSize) {
      ctxCanvas.beginPath();
      ctxCanvas.moveTo(x, 0);
      ctxCanvas.lineTo(x, height);
      ctxCanvas.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctxCanvas.beginPath();
      ctxCanvas.moveTo(0, y);
      ctxCanvas.lineTo(width, y);
      ctxCanvas.stroke();
    }

    // Draw glowing stadium arch effect
    ctxCanvas.fillStyle = 'rgba(79, 70, 229, 0.05)';
    ctxCanvas.beginPath();
    ctxCanvas.arc(width / 2, height + 100, 600, Math.PI, 0);
    ctxCanvas.fill();

    // 3. Draw Premium Header Banner
    ctxCanvas.save();
    ctxCanvas.fillStyle = 'rgba(255, 255, 255, 0.02)';
    drawRoundRect(ctxCanvas, 300, 20, 600, 100, 12);
    ctxCanvas.fill();
    ctxCanvas.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctxCanvas.lineWidth = 1;
    ctxCanvas.stroke();
    ctxCanvas.restore();

    // Draw Glowing "PLAYING XI" Title
    ctxCanvas.save();
    ctxCanvas.fillStyle = '#ffffff';
    ctxCanvas.font = 'bold 36px sans-serif';
    ctxCanvas.textAlign = 'center';
    ctxCanvas.shadowColor = '#00f2fe';
    ctxCanvas.shadowBlur = 15;
    ctxCanvas.fillText('PLAYING XI', width / 2, 65);
    ctxCanvas.restore();

    ctxCanvas.fillStyle = '#a78bfa';
    ctxCanvas.font = 'italic 18px sans-serif';
    ctxCanvas.fillText(`"${teamName}"`, width / 2, 98);

    const teamRating = Math.round(xi.reduce((sum, p) => sum + (p.ovr || 0), 0) / 11);
    
    // Draw OVR badge
    ctxCanvas.fillStyle = 'rgba(167, 139, 250, 0.12)';
    ctxCanvas.beginPath();
    ctxCanvas.arc(1080, 80, 45, 0, Math.PI * 2);
    ctxCanvas.fill();
    ctxCanvas.strokeStyle = '#a78bfa';
    ctxCanvas.lineWidth = 2;
    ctxCanvas.stroke();

    ctxCanvas.fillStyle = '#ffffff';
    ctxCanvas.font = 'bold 28px sans-serif';
    ctxCanvas.fillText(String(teamRating), 1080, 78);
    ctxCanvas.fillStyle = '#a78bfa';
    ctxCanvas.font = 'bold 12px sans-serif';
    ctxCanvas.fillText('TEAM OVR', 1080, 100);

    // Pre-load all card images
    const loadedCards = await Promise.all(
      xi.map(async (p) => {
        try {
          const cardPath = await getOrGeneratePlayerCardPath(p);
          return await loadImage(cardPath);
        } catch (err) {
          console.error(`Failed to load card for ${p.name}:`, err);
          return null;
        }
      })
    );

    const cardWidth = 180;
    const cardHeight = 225; // 4:5 ratio
    const positions = [];

    // Row 1 (y = 160)
    let marginRow1 = (width - (4 * cardWidth)) / 5;
    for (let i = 0; i < 4; i++) {
      positions.push({ x: marginRow1 + i * (cardWidth + marginRow1), y: 170 });
    }

    // Row 2 (y = 425)
    let marginRow2 = (width - (4 * cardWidth)) / 5;
    for (let i = 0; i < 4; i++) {
      positions.push({ x: marginRow2 + i * (cardWidth + marginRow2), y: 435 });
    }

    // Row 3 (y = 690)
    let marginRow3 = (width - (3 * cardWidth)) / 4;
    for (let i = 0; i < 3; i++) {
      positions.push({ x: marginRow3 + i * (cardWidth + marginRow3), y: 700 });
    }

    for (let i = 0; i < 11; i++) {
      const p = xi[i];
      const pos = positions[i];
      const cardImg = loadedCards[i];
      const isCaptain = p.id === captainPlayer.id;

      if (!cardImg) continue;

      if (isCaptain) {
        ctxCanvas.save();
        // Golden glowing shadow aura
        ctxCanvas.shadowColor = '#ffd700';
        ctxCanvas.shadowBlur = 30;
        ctxCanvas.shadowOffsetX = 0;
        ctxCanvas.shadowOffsetY = 0;

        // Draw card image with shadow applied
        ctxCanvas.drawImage(cardImg, pos.x, pos.y, cardWidth, cardHeight);
        ctxCanvas.restore();

        // Draw a premium gold border around the captain card
        ctxCanvas.strokeStyle = '#ffd700';
        ctxCanvas.lineWidth = 3;
        ctxCanvas.strokeRect(pos.x, pos.y, cardWidth, cardHeight);

        // Draw Gold Crown above the card
        ctxCanvas.fillStyle = '#ffd700';
        ctxCanvas.save();
        ctxCanvas.shadowColor = '#ffd700';
        ctxCanvas.shadowBlur = 10;
        ctxCanvas.beginPath();
        const cx = pos.x + cardWidth / 2;
        const cy = pos.y - 22;
        const cw = 24;
        const ch = 16;
        ctxCanvas.moveTo(cx - cw/2, cy + ch/2);
        ctxCanvas.lineTo(cx + cw/2, cy + ch/2);
        ctxCanvas.lineTo(cx + cw/2, cy - ch/4);
        ctxCanvas.lineTo(cx + cw/4, cy + ch/8);
        ctxCanvas.lineTo(cx, cy - ch/2);
        ctxCanvas.lineTo(cx - cw/4, cy + ch/8);
        ctxCanvas.lineTo(cx - cw/2, cy - ch/4);
        ctxCanvas.closePath();
        ctxCanvas.fill();
        ctxCanvas.restore();

        // Draw Captain Badge: A clean gold pill badge with text "CAPTAIN"
        const badgeW = 90;
        const badgeH = 20;
        const badgeX = pos.x + cardWidth / 2 - badgeW / 2;
        const badgeY = pos.y - 7;

        ctxCanvas.fillStyle = '#ffd700';
        drawRoundRect(ctxCanvas, badgeX, badgeY, badgeW, badgeH, 4);
        ctxCanvas.fill();

        // Write "CAPTAIN" inside badge
        ctxCanvas.fillStyle = '#000000';
        ctxCanvas.font = 'bold 11px sans-serif';
        ctxCanvas.textAlign = 'center';
        ctxCanvas.fillText('CAPTAIN', pos.x + cardWidth / 2, badgeY + 14);
      } else {
        // Draw normal card
        ctxCanvas.drawImage(cardImg, pos.x, pos.y, cardWidth, cardHeight);
      }

      // Draw Pos Number Badge at top-left of each card
      ctxCanvas.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctxCanvas.beginPath();
      ctxCanvas.arc(pos.x + 20, pos.y + 20, 14, 0, Math.PI * 2);
      ctxCanvas.fill();
      
      ctxCanvas.strokeStyle = isCaptain ? '#ffd700' : 'rgba(255, 255, 255, 0.4)';
      ctxCanvas.lineWidth = 1.5;
      ctxCanvas.stroke();

      ctxCanvas.fillStyle = '#ffffff';
      ctxCanvas.font = 'bold 12px sans-serif';
      ctxCanvas.textAlign = 'center';
      ctxCanvas.fillText(String(i + 1), pos.x + 20, pos.y + 24);
    }

    const outPath = path.join(__dirname, '..', 'scratch', 'playing11_test.png');
    fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
    console.log("Playing XI board generated successfully at:", outPath);

  } finally {
    await sb.supabase.from('user_owned_players').delete().eq('user_id', testUserId);
    console.log("Cleanup complete.");
  }
}

test().catch(console.error);
