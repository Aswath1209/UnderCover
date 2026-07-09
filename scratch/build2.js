const fs = require('fs');
const srcCode = fs.readFileSync('/home/home/ReactNative/Telegram/cricket-bot/game/scoreboardGenerator.js', 'utf8');

// Replace function signature
let newCode = srcCode.replace(
  "async function generateScoreboardImage(tour, resultText, potmName) {",
  "async function generateScoreboardImage(match, resultObj, marginText) {"
);

// Replace template path
newCode = newCode.replace(
  "const bgPath = path.join(__dirname, '../assets/scoreboard_template3.jpeg');",
  "const bgPath = path.join(__dirname, '../assets/ScoreTemplate4.jpeg');"
);

// We need to replace the variables that depend on `tour` with ones depending on `match/resultObj`.
// Let's replace the block from `// Setup first and second batting teams` down to `const data = {`
const replaceStart = "// Setup first and second batting teams";
const replaceEnd = "const truncName = (name, max = 20) => name.length > max ? name.substring(0, max) + '..' : name;";

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
    let potmStatsStr = "";
    let potmName = resultObj.motm || null;

    const truncName = (name, max = 20) => name.length > max ? name.substring(0, max) + '..' : name;
`;

const startIndex = newCode.indexOf(replaceStart);
const endIndex = newCode.indexOf(replaceEnd) + replaceEnd.length;

newCode = newCode.substring(0, startIndex) + dataMapping + newCode.substring(endIndex);

// Now we need to fix data object initialization to match our variables
newCode = newCode.replace(
  "name: truncName(normalizeStyledText(team1.name).toUpperCase(), 32),",
  "name: truncName(team1Name.toUpperCase(), 32),"
).replace(
  "overs: \`${team1Overs} OVERS\`,",
  "overs: \`${team1OversStr} OVERS\`,"
).replace(
  "scoreStr: \`${team1Score}-${team1.wickets || 0}\`,",
  "scoreStr: \`${team1Score}-${team1Wickets}\`,"
);

newCode = newCode.replace(
  "name: truncName(normalizeStyledText(team2.name).toUpperCase(), 32),",
  "name: truncName(team2Name.toUpperCase(), 32),"
).replace(
  "overs: \`${team2Overs} OVERS\`,",
  "overs: \`${team2OversStr} OVERS\`,"
).replace(
  "scoreStr: \`${team2Score}-${team2.wickets || 0}\`,",
  "scoreStr: \`${team2Score}-${team2Wickets}\`,"
);

fs.writeFileSync('/home/home/ReactNative/Telegram/undercover-bot/game/scoreboardGenerator.js', newCode);
console.log('Fixed');
