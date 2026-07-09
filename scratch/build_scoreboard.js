const fs = require('fs');
const path = require('path');

const srcCode = fs.readFileSync('/home/home/ReactNative/Telegram/cricket-bot/game/scoreboardGenerator.js', 'utf8');

// We need the font setup, normalizeStyledText, drawTextWithEmojis, and the canvas rendering loop.
// We'll replace the `generateScoreboardImage(tour, resultText, potmName)` signature 
// with `generateScoreboardImage(match, result, marginText)`

let code = srcCode.replace(
  "async function generateScoreboardImage(tour, resultText, potmName) {",
  "async function generateScoreboardImage(match, resultObj, marginText) {"
);

// We need to map `match` variables to `team1`, `team2`, `team1Score`, etc.
const dataMapping = `
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

        if (hostId && hostId === battingId) battingXI = match.host?.xi || [];
        else battingXI = match.guest?.xi || [];

        if (hostId && hostId === bowlingId) bowlingXI = match.host?.xi || [];
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

    let resultText = marginText ? \`\${resultObj.winner?.teamName || resultObj.winner?.username || ''} \${marginText}\` : 'MATCH DRAWN';
    let potmStatsStr = ""; // POTM not implemented in undercover-bot yet
    let potmName = resultObj.motm || null;

    const data = {
        team1: {
            name: truncName(team1Name.toUpperCase(), 32),
            overs: \`\${team1OversStr} OVERS\`,
            scoreStr: \`\${team1Score}-\${team1Wickets}\`,
            batters: inn1Performers.batsmen,
            bowlers: inn1Performers.bowlers
        },
        team2: {
            name: truncName(team2Name.toUpperCase(), 32),
            overs: \`\${team2OversStr} OVERS\`,
            scoreStr: \`\${team2Score}-\${team2Wickets}\`,
            batters: inn2Performers.batsmen,
            bowlers: inn2Performers.bowlers
        },
        result: truncName(resultText.toUpperCase(), 60),
        motm: potmName ? \`\${normalizeStyledText(potmName).toUpperCase()}\` : ""
    };
`;

// Extract from "try {" up to the old "const data =" in cricket-bot code
const topRegex = /try \{[\s\S]*?(?=\/\/ Setup first and second batting teams)/;
const bottomRegex = /\n    \/\/ ===== TITLE DATA =====[\s\S]*?(?=return canvas\.toBuffer)/;

const topMatch = code.match(topRegex);
const bottomMatch = code.match(bottomRegex);

let newCode = code.substring(0, code.indexOf('async function generateScoreboardImage'));
newCode += "async function generateScoreboardImage(match, resultObj, marginText) {\n";
newCode += topMatch[0];
newCode += "    const bgPath = path.join(__dirname, '../assets/ScoreTemplate4.jpeg');\n";
newCode += "    const bg = await loadImage(bgPath);\n";
newCode += "    const canvas = createCanvas(bg.width, bg.height);\n";
newCode += "    const ctx = canvas.getContext('2d');\n";
newCode += "    ctx.drawImage(bg, 0, 0);\n";
newCode += dataMapping;
newCode += bottomMatch[0];
newCode += `
    return canvas.toBuffer("image/png");
  } catch (err) {
    console.error("Error generating TV scoreboard image:", err);
    return null;
  }
}

module.exports = {
  generateScoreboardImage
};
`;

fs.writeFileSync('/home/home/ReactNative/Telegram/undercover-bot/game/scoreboardGenerator.js', newCode);
console.log('Created scoreboardGenerator.js');
