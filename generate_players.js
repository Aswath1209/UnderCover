const fs = require('fs');
const path = require('path');

const firstNames = ['Steve', 'David', 'Chris', 'Jason', 'Ben', 'Joe', 'Jos', 'Pat', 'Mitchell', 'Trent', 'Kagiso', 'Shaheen', 'Rashid', 'Shakib', 'Glenn', 'Quinton', 'Ricky', 'Brian', 'Jacques', 'Stuart', 'James', 'Dale', 'Brett', 'Shoaib', 'Wasim', 'Waqar', 'Kapil', 'Imran', 'Ian', 'Richard', 'Viv', 'Sunil', 'Adam', 'Mark', 'Matthew', 'Michael', 'Mahela', 'Kumar', 'Sanath', 'Aravinda', 'Inzamam', 'Younis', 'Javed', 'Saeed', 'Martin', 'Brendon', 'Ross', 'Stephen', 'Daniel', 'Shane', 'Graeme', 'Hashim', 'Herschelle', 'Gary', 'Allan', 'Gordon', 'Courtney', 'Curtly', 'Malcolm', 'Andy', 'Grant', 'Tim', 'Tom', 'Sam', 'Moeen', 'Adil', 'Jofra', 'Jonny', 'Eoin', 'Alex', 'Liam'];
const lastNames = ['Smith', 'Warner', 'Gayle', 'Holder', 'Stokes', 'Root', 'Buttler', 'Cummins', 'Starc', 'Boult', 'Rabada', 'Afridi', 'Khan', 'Al Hasan', 'Maxwell', 'de Kock', 'Ponting', 'Lara', 'Kallis', 'Broad', 'Anderson', 'Steyn', 'Lee', 'Akhtar', 'Akram', 'Dev', 'Botham', 'Hadlee', 'Richards', 'Gavaskar', 'Gilchrist', 'Waugh', 'Hayden', 'Hussey', 'Jayawardene', 'Sangakkara', 'Jayasuriya', 'de Silva', 'ul-Haq', 'Miandad', 'Anwar', 'Crowe', 'McCullum', 'Taylor', 'Fleming', 'Vettori', 'Amla', 'Gibbs', 'Kirsten', 'Donald', 'Greenidge', 'Walsh', 'Ambrose', 'Marshall', 'Flower', 'Southee', 'Latham', 'Curran', 'Ali', 'Archer', 'Wood', 'Bairstow', 'Morgan', 'Hales', 'Livingstone', 'Roy'];

function randomRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const statsPath = path.join(__dirname, 'data', 'hiloStats.json');
let players = [];

try {
    const raw = fs.readFileSync(statsPath, 'utf8');
    players = JSON.parse(raw);
} catch (e) {
    console.error("Could not read original hiloStats.json", e);
}

const needed = 250 - players.length;

for(let i=0; i<needed; i++) {
    const fn = firstNames[randomRange(0, firstNames.length-1)];
    const ln = lastNames[randomRange(0, lastNames.length-1)];
    const name = fn + ' ' + ln + ' (Classic)';
    
    // Make sure we don't duplicate names exactly
    if (players.find(p => p.name === name)) {
        continue;
    }
    
    const isBatsman = Math.random() > 0.5;
    
    let testRuns = isBatsman ? randomRange(2000, 11000) : randomRange(100, 2500);
    let odiRuns = isBatsman ? randomRange(2000, 9500) : randomRange(50, 1200);
    let t20Runs = isBatsman ? randomRange(500, 3500) : randomRange(10, 400);
    
    let testWickets = !isBatsman ? randomRange(100, 500) : randomRange(0, 40);
    let odiWickets = !isBatsman ? randomRange(100, 350) : randomRange(0, 25);
    let t20Wickets = !isBatsman ? randomRange(50, 130) : randomRange(0, 15);
    
    let centuries = isBatsman ? randomRange(5, 45) : randomRange(0, 1);
    let matches = randomRange(50, 350);

    players.push({
        "name": name,
        "Test Runs": testRuns,
        "ODI Runs": odiRuns,
        "T20I Runs": t20Runs,
        "Test Wickets": testWickets,
        "ODI Wickets": odiWickets,
        "T20I Wickets": t20Wickets,
        "International Centuries": centuries,
        "International Matches": matches
    });
}

fs.writeFileSync(statsPath, JSON.stringify(players, null, 4));
console.log(`Successfully boosted player list to ${players.length} players!`);
