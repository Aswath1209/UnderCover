const fs = require('fs');

const path = '/home/home/ReactNative/Telegram/undercover-bot/game/scoreboardGenerator.js';
let code = fs.readFileSync(path, 'utf8');

// Fix strict equality bug
code = code.replace(/hostId === battingId/g, 'hostId == battingId');
code = code.replace(/hostId === bowlingId/g, 'hostId == bowlingId');

// Add MOTM calculation logic
const motmReplaceStart = '    let potmStatsStr = "";';
const motmReplaceEnd = '    const truncName = (name, max = 20) => name.length > max ? name.substring(0, max) + \'..\' : name;';

const motmLogic = `
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
                parts.push(\`\${stats.runs || 0}(\${stats.balls || 0})\`);
            }
            if ((stats.overs || 0) > 0 || stats.wickets > 0) {
                parts.push(\`\${stats.wickets || 0}/\${stats.runsConceded || 0}\`);
            }
            potmStatsStr = parts.length > 0 ? "  " + parts.join("  ") : "";
        }
    }

    const truncName = (name, max = 20) => name.length > max ? name.substring(0, max) + '..' : name;
`;

const startIndex = code.indexOf(motmReplaceStart);
const endIndex = code.indexOf(motmReplaceEnd) + motmReplaceEnd.length;

if (startIndex !== -1 && endIndex > startIndex) {
    code = code.substring(0, startIndex) + motmLogic + code.substring(endIndex);
}

// Update the motm text to include the stats
code = code.replace(
    'motm: potmName ? `${normalizeStyledText(potmName).toUpperCase()}` : ""',
    'motm: potmName ? `${normalizeStyledText(potmName).toUpperCase()}${potmStatsStr}` : ""'
);

fs.writeFileSync(path, code);
console.log('Fixed scoreboardGenerator.js');
