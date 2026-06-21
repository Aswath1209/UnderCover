const path = require('path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

// Load system fonts for fallback support (e.g. emoji and star characters)
try {
  GlobalFonts.loadSystemFonts();
} catch (e) {
  console.error("Failed to load system fonts:", e);
}

// Register Bebas Neue and other custom fonts
let hasFishmonger = false;
try {
  GlobalFonts.registerFromPath(path.join(__dirname, '../assets/fonts/BebasNeue-Regular.ttf'), 'BebasNeue');
  
  // Register Saira (high-fidelity fallback for Fishmonger MS Italic)
  GlobalFonts.registerFromPath(path.join(__dirname, '../assets/fonts/Saira-BoldItalic.ttf'), 'Saira');
  GlobalFonts.registerFromPath(path.join(__dirname, '../assets/fonts/Saira-SemiBoldItalic.ttf'), 'Saira');
  
  // Dynamic scanning for any Fishmonger fonts uploaded by the user
  const fs = require('fs');
  const dirsToScan = [
    path.join(__dirname, '../assets/fonts'),
    path.join(__dirname, '../fonts')
  ];
  
  for (const dir of dirsToScan) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.toLowerCase().includes('fishmonger')) {
          GlobalFonts.registerFromPath(path.join(dir, file), 'Fishmonger');
          hasFishmonger = true;
          console.log(`Registered custom font: ${file} as 'Fishmonger'`);
        }
      }
    }
  }

  // Register esoteric fonts for user names
  const fontsDir = path.join(__dirname, '../fonts');
  const emojiPath = path.join(fontsDir, 'NotoColorEmoji.ttf');
  if (fs.existsSync(emojiPath)) GlobalFonts.registerFromPath(emojiPath, 'Noto Color Emoji');
  
  const krPath = path.join(fontsDir, 'NotoSansKR.otf');
  if (fs.existsSync(krPath)) GlobalFonts.registerFromPath(krPath, 'Noto Sans KR');

  const egPath = path.join(fontsDir, 'NotoEgyptian.ttf');
  if (fs.existsSync(egPath)) GlobalFonts.registerFromPath(egPath, 'Noto Egyptian');

  const taiPath = path.join(fontsDir, 'NotoTaiTham.ttf');
  if (fs.existsSync(taiPath)) GlobalFonts.registerFromPath(taiPath, 'Noto Tai Tham');

  const mathPath = path.join(fontsDir, 'NotoMath.ttf');
  if (fs.existsSync(mathPath)) GlobalFonts.registerFromPath(mathPath, 'Noto Math');

} catch (e) {
  console.error("Failed to load custom fonts:", e);
}


function normalizeStyledText(text) {
  if (!text) return '';
  const chars = [...String(text)];
  let normal = '';
  
  for (const ch of chars) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x1D400 && cp <= 0x1D7FF) {
      normal += ch.normalize('NFKC');
    } else {
      normal += ch;
    }
  }
  
  normal = normal.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u200B-\u200D\uFEFF]/g, '');
  return normal.replace(/([\uAAB0-\uAABF])/g, '\u25CC$1');
}

function drawTextWithEmojis(ctx, text, x, y, fontSpec, emojiFontFamily = 'Noto Color Emoji') {
  y = y + 10; // Shift all text down by 10 pixels
  if (text === undefined || text === null) return;
  const str = String(text);
  
  const fontParts = fontSpec.split(/\s+/);
  const family = fontParts[fontParts.length - 1].replace(/['"]/g, '');
  const sizeAndStyle = fontParts.slice(0, -1).join(' ');
  
  let primaryFamily = family;
  if (family === 'Arial' || family === 'sans-serif' || family === 'DejaVu') {
    primaryFamily = 'DejaVu Sans';
  }
  
  const primaryFont = `${sizeAndStyle} "${primaryFamily}", "Noto Color Emoji", "Noto Sans KR", "Noto Egyptian", "Noto Tai Tham", "Noto Math", "DejaVu Sans", sans-serif`;
  const emojiFont = `${sizeAndStyle} "${emojiFontFamily}"`;
  
  const segments = str.split(/(\p{RGI_Emoji})/v);
  const activeSegments = segments.filter(seg => seg !== '');
  
  const details = activeSegments.map(seg => {
    const isEmoji = /^\p{RGI_Emoji}$/v.test(seg);
    ctx.save();
    ctx.font = isEmoji ? emojiFont : primaryFont;
    const metrics = ctx.measureText(seg);
    ctx.restore();
    return {
      text: seg,
      isEmoji,
      width: metrics.width
    };
  });
  
  const totalWidth = details.reduce((sum, d) => sum + d.width, 0);
  
  let currentX = x;
  const align = ctx.textAlign || 'left';
  if (align === 'center') {
    currentX = x - totalWidth / 2;
  } else if (align === 'right') {
    currentX = x - totalWidth;
  }
  
  const originalAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  
  for (const d of details) {
    ctx.save();
    ctx.font = d.isEmoji ? emojiFont : primaryFont;
    ctx.fillText(d.text, currentX, y);
    ctx.restore();
    currentX += d.width;
  }
  
  ctx.textAlign = originalAlign;
}


function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawOrnateBorder(ctx, x, y, w, h, radius) {
  drawRoundedRect(ctx, x, y, w, h, radius);
  ctx.stroke();

  // Inner orange/red frame line
  const offset = 8;
  ctx.save();
  ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  drawRoundedRect(ctx, x + offset, y + offset, w - offset * 2, h - offset * 2, radius - 2);
  ctx.stroke();
  ctx.restore();

  // Corner decorative dots
  ctx.fillStyle = '#ef4444';
  const corners = [
    [x + offset, y + offset],
    [x + w - offset, y + offset],
    [x + offset, y + h - offset],
    [x + w - offset, y + h - offset]
  ];
  corners.forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

async function generateScoreboardImage(match, resultObj, marginText) {
  try {
    const bgPath = path.join(__dirname, '../assets/ScoreTemplate4.jpeg');
    const bg = await loadImage(bgPath);

    const canvas = createCanvas(bg.width, bg.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(bg, 0, 0);

    
    const hostId = match.host?.telegramId ? match.host.telegramId.toString() : '';
    const hostName = match.host?.teamName || match.host?.username || 'Host';
    const guestName = (match.guest && (match.guest.teamName || match.guest.username)) || (match.guest ? 'Guest' : 'AI Bot');

    const inn1 = match.innings[0] || {};
    const inn2 = match.innings[1] || {};
    const inn1BattingId = inn1.battingId ? inn1.battingId.toString() : '';
    const inn2BattingId = inn2.battingId ? inn2.battingId.toString() : '';
    
    const team1Name = ((hostId && inn1BattingId === hostId) ? hostName : guestName) || 'Unknown';
    const team2Name = ((hostId && inn2BattingId === hostId) ? hostName : guestName) || 'Unknown';

    const getPerformers = (inningsIdx) => {
        const inn = match.innings[inningsIdx];
        if (!inn) return { batsmen: [], bowlers: [] };

        const battingId = inn.battingId ? inn.battingId.toString() : '';
        const bowlingId = inn.bowlingId ? inn.bowlingId.toString() : '';
        
        let battingXI = [];
        let bowlingXI = [];

        if (hostId && hostId == battingId) battingXI = match.host?.xi || [];
        else battingXI = match.guest?.xi || [];

        if (hostId && hostId == bowlingId) bowlingXI = match.host?.xi || [];
        else bowlingXI = match.guest?.xi || [];

        const batsmen = battingXI
            .map(player => {
                const stats = match.stats[player.id] || {};
                const name = normalizeStyledText(player.name || '');
                const runs = stats.runs || 0;
                const balls = stats.balls || 0;
                const fours = stats.fours || 0;
                const sixes = stats.sixes || 0;
                const sr = balls > 0 ? ((runs / balls) * 100).toFixed(1) : "0.0";
                return { name, runs, balls, fours, sixes, sr };
            })
            .filter(p => p.balls > 0 || p.runs > 0)
            .sort((a, b) => b.runs - a.runs)
            .slice(0, 4);

        const bowlers = bowlingXI
            .map(player => {
                const stats = match.stats[player.id] || {};
                const name = normalizeStyledText(player.name || '');
                const wickets = stats.wickets || 0;
                const runsConceded = stats.runsConceded || 0;
                const oversNum = stats.overs || 0;
                const overs = typeof oversNum === 'number' ? oversNum.toFixed(1) : parseFloat(oversNum || 0).toFixed(1);
                const oversVal = parseFloat(overs);
                const econ = oversVal > 0 ? (runsConceded / oversVal).toFixed(1) : "0.0";
                return { name, overs, runs: runsConceded, wickets, econ };
            })
            .filter(p => parseFloat(p.overs) > 0 || p.wickets > 0 || p.runs > 0)
            .sort((a, b) => {
                if (b.wickets !== a.wickets) return b.wickets - a.wickets;
                return a.runs - b.runs;
            })
            .slice(0, 4);

        return { batsmen, bowlers };
    };

    const team1Score = resultObj.inn1Runs || 0;
    const team1Wickets = resultObj.inn1Wickets || 0;
    const team1OversStr = resultObj.inn1Overs ? String(resultObj.inn1Overs) : "0";
    
    const team2Score = resultObj.inn2Runs || 0;
    const team2Wickets = resultObj.inn2Wickets || 0;
    const team2OversStr = resultObj.inn2Overs ? String(resultObj.inn2Overs) : "0";

    const inn1Performers = getPerformers(0);
    const inn2Performers = getPerformers(1);

    let resultText = marginText ? `${resultObj.winner?.teamName || resultObj.winner?.username || ''} ${marginText}` : 'MATCH DRAWN';

    let potmStatsStr = "";
    let potmName = resultObj.motm || null;

    if (potmName) {
        const normPotm = normalizeStyledText(potmName);
        const allPlayers = [...(match.host?.xi || []), ...(match.guest?.xi || [])];
        const potmPlayer = allPlayers.find(p => normalizeStyledText(p.name || '') === normPotm);

        if (potmPlayer) {
            const stats = match.stats[potmPlayer.id] || {};
            let parts = [];
            if (stats.runs > 0 || stats.balls > 0) {
                parts.push(`${stats.runs || 0}(${stats.balls || 0})`);
            }
            if ((stats.overs || 0) > 0 || stats.wickets > 0) {
                parts.push(`${stats.wickets || 0}/${stats.runsConceded || 0}`);
            }
            potmStatsStr = parts.length > 0 ? "  " + parts.join("  ") : "";
        }
    }

    const truncName = (name, max = 20) => name.length > max ? name.substring(0, max) + '..' : name;



    const data = {
        team1: {
            name: truncName(team1Name.toUpperCase(), 32),
            overs: `${team1OversStr} OVERS`,
            scoreStr: `${team1Score}-${team1Wickets}`,
            batters: inn1Performers.batsmen,
            bowlers: inn1Performers.bowlers
        },
        team2: {
            name: truncName(team2Name.toUpperCase(), 32),
            overs: `${team2OversStr} OVERS`,
            scoreStr: `${team2Score}-${team2Wickets}`,
            batters: inn2Performers.batsmen,
            bowlers: inn2Performers.bowlers
        },
        result: truncName(resultText.toUpperCase(), 60),
        motm: potmName ? `${normalizeStyledText(potmName).toUpperCase()}${potmStatsStr}` : ""
    };

    // ===== TITLE DATA =====
    ctx.fillStyle = "#FFFFFF";

    // Team 1
    ctx.textAlign = "left";
    drawTextWithEmojis(ctx, data.team1.name, 90, 212, "italic bold 32px Arial");
    ctx.textAlign = "right";
    drawTextWithEmojis(ctx, data.team1.overs, 1200, 212, "italic bold 32px Arial");
    drawTextWithEmojis(ctx, data.team1.scoreStr, 1390, 212, "italic bold 32px Arial");

    // Team 2
    ctx.textAlign = "left";
    drawTextWithEmojis(ctx, data.team2.name, 90, 528, "italic bold 32px Arial");
    ctx.textAlign = "right";
    drawTextWithEmojis(ctx, data.team2.overs, 1200, 528, "italic bold 32px Arial");
    drawTextWithEmojis(ctx, data.team2.scoreStr, 1390, 528, "italic bold 32px Arial");

    // Helper already moved up

    // ===== TEAM 1 BATTERS =====
    const t1BatY = [310, 356, 402, 448];

    data.team1.batters.forEach((p, i) => {
        const y = t1BatY[i];
        ctx.fillStyle = "#FFFFFF";

        ctx.textAlign = "left";
        drawTextWithEmojis(ctx, truncName(p.name.toUpperCase(), 21), 110, y, "17px Arial");
        
        ctx.textAlign = "center";
        drawTextWithEmojis(ctx, p.runs.toString(), 402, y, "17px Arial");
        drawTextWithEmojis(ctx, p.balls.toString(), 492, y, "17px Arial");
        drawTextWithEmojis(ctx, p.fours.toString(), 572, y, "17px Arial");
        drawTextWithEmojis(ctx, p.sixes.toString(), 634, y, "17px Arial");
        drawTextWithEmojis(ctx, p.sr.toString(), 717, y, "17px Arial");
    });

    // ===== TEAM 1 BOWLERS =====
    data.team1.bowlers.forEach((p, i) => {
        const y = t1BatY[i];
        ctx.fillStyle = "#FFFFFF";

        ctx.textAlign = "left";
        drawTextWithEmojis(ctx, truncName(p.name.toUpperCase(), 23), 794, y, "17px Arial");
        
        ctx.textAlign = "center";
        drawTextWithEmojis(ctx, p.overs.toString(), 1109, y, "17px Arial");
        drawTextWithEmojis(ctx, p.runs.toString(), 1211, y, "17px Arial");
        drawTextWithEmojis(ctx, p.wickets.toString(), 1312, y, "17px Arial");
        drawTextWithEmojis(ctx, p.econ.toString(), 1416, y, "17px Arial");
    });

    // ===== TEAM 2 BATTERS =====
    const t2BatY = [627, 673, 719, 765];

    data.team2.batters.forEach((p, i) => {
        const y = t2BatY[i];
        ctx.fillStyle = "#FFFFFF";

        ctx.textAlign = "left";
        drawTextWithEmojis(ctx, truncName(p.name.toUpperCase(), 21), 110, y, "17px Arial");
        
        ctx.textAlign = "center";
        drawTextWithEmojis(ctx, p.runs.toString(), 402, y, "17px Arial");
        drawTextWithEmojis(ctx, p.balls.toString(), 492, y, "17px Arial");
        drawTextWithEmojis(ctx, p.fours.toString(), 572, y, "17px Arial");
        drawTextWithEmojis(ctx, p.sixes.toString(), 634, y, "17px Arial");
        drawTextWithEmojis(ctx, p.sr.toString(), 717, y, "17px Arial");
    });

    // ===== TEAM 2 BOWLERS =====
    const t2BowlY = [629, 675, 721, 767];
    data.team2.bowlers.forEach((p, i) => {
        const y = t2BowlY[i];
        ctx.fillStyle = "#FFFFFF";

        ctx.textAlign = "left";
        drawTextWithEmojis(ctx, truncName(p.name.toUpperCase(), 23), 794, y, "17px Arial");
        
        ctx.textAlign = "center";
        drawTextWithEmojis(ctx, p.overs.toString(), 1109, y, "17px Arial");
        drawTextWithEmojis(ctx, p.runs.toString(), 1211, y, "17px Arial");
        drawTextWithEmojis(ctx, p.wickets.toString(), 1312, y, "17px Arial");
        drawTextWithEmojis(ctx, p.econ.toString(), 1416, y, "17px Arial");
    });

    // ===== RESULT =====
    const resultUpper = data.result;
    const t1Name = data.team1.name;
    const t2Name = data.team2.name;
    
    let winnerColor = null;
    let matchTeamName = "";
    
    if (resultUpper.startsWith(t1Name)) {
        winnerColor = "#FF7A00"; // Orange for Team 1
        matchTeamName = t1Name;
    } else if (resultUpper.startsWith(t2Name)) {
        winnerColor = "#22C55E"; // Green for Team 2
        matchTeamName = t2Name;
    }
    
    const resultFontFamily = hasFishmonger ? 'Fishmonger' : 'Saira';
    const fontSpec = `italic bold 30px ${resultFontFamily}`;
    const fontSpecMeasure = `italic bold 30px "${resultFontFamily}"`;

    if (winnerColor && matchTeamName) {
        const restText = resultUpper.substring(matchTeamName.length);
        
        ctx.save();
        ctx.font = fontSpecMeasure;
        const w1 = ctx.measureText(matchTeamName).width;
        const w2 = ctx.measureText(restText).width;
        const totalW = w1 + w2;
        
        const startX = canvas.width / 2 - totalW / 2;
        
        ctx.textAlign = "left";
        ctx.fillStyle = winnerColor;
        drawTextWithEmojis(ctx, matchTeamName, startX, 850, fontSpec);
        
        ctx.fillStyle = "#FFFFFF";
        drawTextWithEmojis(ctx, restText, startX + w1, 850, fontSpec);
        ctx.restore();
    } else {
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        drawTextWithEmojis(ctx, data.result, canvas.width / 2, 850, fontSpec);
    }

    // ===== MOTM =====
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    drawTextWithEmojis(ctx, data.motm, 550, 948, fontSpec);

    return canvas.toBuffer("image/png");
  } catch (err) {
    console.error("Error generating TV scoreboard image:", err);
    return null;
  }
}


module.exports = {
  generateScoreboardImage,
  normalizeStyledText
};
