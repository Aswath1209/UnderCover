const fs = require('fs');
const { generateScoreboardImage } = require('../game/scoreboardGenerator');

const match = {
    host: { telegramId: 1, teamName: 'INDIAN CRICKET TEAM', xi: [
        { id: '101', name: 'Rohit Sharma' }, 
        { id: '102', name: 'Virat Kohli' }, 
        { id: '103', name: 'Suryakumar Yadav' },
        { id: '104', name: 'Jasprit Bumrah' },
        { id: '105', name: 'Mohammed Siraj' }
    ]},
    guest: { telegramId: 2, teamName: 'ENGLAND LIONS XI', xi: [
        { id: '201', name: 'Jos Buttler' }, 
        { id: '202', name: 'Phil Salt' }, 
        { id: '203', name: 'Liam Livingstone' },
        { id: '204', name: 'Jofra Archer' },
        { id: '205', name: 'Mark Wood' }
    ]},
    innings: [
        { battingId: 1, bowlingId: 2 },
        { battingId: 2, bowlingId: 1 }
    ],
    stats: {
        '101': { runs: 55, balls: 40, fours: 4, sixes: 2 },
        '102': { runs: 28, balls: 20, fours: 3, sixes: 0 },
        '103': { runs: 18, balls: 10, fours: 2, sixes: 1 },
        '104': { runs: 0, balls: 0, wickets: 3, runsConceded: 20, overs: 4 },
        '105': { runs: 0, balls: 0, wickets: 1, runsConceded: 25, overs: 4 },
        '201': { runs: 42, balls: 30, fours: 5, sixes: 1 },
        '202': { runs: 12, balls: 8, fours: 1, sixes: 0 },
        '203': { runs: 22, balls: 15, fours: 2, sixes: 1 },
        '204': { runs: 0, balls: 0, wickets: 2, runsConceded: 35, overs: 4 },
        '205': { runs: 0, balls: 0, wickets: 1, runsConceded: 40, overs: 4 }
    }
};

const result = {
    inn1Runs: 180, inn1Wickets: 5, inn1Overs: 20,
    inn2Runs: 160, inn2Wickets: 8, inn2Overs: 20,
    winner: { teamName: 'INDIAN CRICKET TEAM' },
    motm: 'Rohit Sharma' // Added MOTM string
};

generateScoreboardImage(match, result, 'won by 20 runs').then(buf => {
    fs.writeFileSync('./preview_undercover.png', buf);
    console.log('Saved preview_undercover.png');
}).catch(console.error);
