const fs = require('fs');
const path = require('path');

const playersData = [
  { name: "Virat Kohli", role: "batsman" }, { name: "Rohit Sharma", role: "batsman" }, { name: "MS Dhoni", role: "wk" },
  { name: "Sachin Tendulkar", role: "batsman" }, { name: "Babar Azam", role: "batsman" }, { name: "David Warner", role: "batsman" },
  { name: "Chris Gayle", role: "batsman" }, { name: "Jasprit Bumrah", role: "bowler" }, { name: "Lasith Malinga", role: "bowler" },
  { name: "AB de Villiers", role: "wk" }, { name: "Steve Smith", role: "batsman" }, { name: "Joe Root", role: "batsman" },
  { name: "Kane Williamson", role: "batsman" }, { name: "Ben Stokes", role: "allrounder" }, { name: "Jos Buttler", role: "wk" },
  { name: "Pat Cummins", role: "bowler" }, { name: "Mitchell Starc", role: "bowler" }, { name: "Trent Boult", role: "bowler" },
  { name: "Kagiso Rabada", role: "bowler" }, { name: "Shaheen Afridi", role: "bowler" }, { name: "Rashid Khan", role: "bowler" },
  { name: "Shakib Al Hasan", role: "allrounder" }, { name: "Glenn Maxwell", role: "allrounder" }, { name: "Quinton de Kock", role: "wk" },
  { name: "Ricky Ponting", role: "batsman" }, { name: "Brian Lara", role: "batsman" }, { name: "Jacques Kallis", role: "allrounder" },
  { name: "Muttiah Muralitharan", role: "bowler" }, { name: "Shane Warne", role: "bowler" }, { name: "Hardik Pandya", role: "allrounder" },
  { name: "Sunil Narine", role: "bowler" }, { name: "Yuzvendra Chahal", role: "bowler" }, { name: "Shikhar Dhawan", role: "batsman" },
  { name: "KL Rahul", role: "batsman" }, { name: "Rishabh Pant", role: "wk" }, { name: "Ravindra Jadeja", role: "allrounder" },
  { name: "R Ashwin", role: "bowler" }, { name: "Mohammed Shami", role: "bowler" }, { name: "Virender Sehwag", role: "batsman" },
  { name: "Gautam Gambhir", role: "batsman" }, { name: "Yuvraj Singh", role: "allrounder" }, { name: "Suresh Raina", role: "batsman" },
  { name: "Zaheer Khan", role: "bowler" }, { name: "Anil Kumble", role: "bowler" }, { name: "Harbhajan Singh", role: "bowler" },
  { name: "Rahul Dravid", role: "batsman" }, { name: "VVS Laxman", role: "batsman" }, { name: "Sourav Ganguly", role: "batsman" },
  { name: "Kapil Dev", role: "allrounder" }, { name: "Irfan Pathan", role: "allrounder" }, { name: "Javagal Srinath", role: "bowler" },
  { name: "Ajit Agarkar", role: "bowler" }, { name: "Steve Waugh", role: "batsman" }, { name: "Adam Gilchrist", role: "wk" },
  { name: "Matthew Hayden", role: "batsman" }, { name: "Glenn McGrath", role: "bowler" }, { name: "Brett Lee", role: "bowler" },
  { name: "Mitchell Johnson", role: "bowler" }, { name: "Jason Gillespie", role: "bowler" }, { name: "Michael Clarke", role: "batsman" },
  { name: "Aaron Finch", role: "batsman" }, { name: "Josh Hazlewood", role: "bowler" }, { name: "Nathan Lyon", role: "bowler" },
  { name: "Allan Border", role: "batsman" }, { name: "Mark Waugh", role: "batsman" }, { name: "Ian Healy", role: "wk" },
  { name: "Michael Hussey", role: "batsman" }, { name: "Andrew Symonds", role: "allrounder" }, { name: "Mitchell Marsh", role: "allrounder" },
  { name: "Usman Khawaja", role: "batsman" }, { name: "Marnus Labuschagne", role: "batsman" }, { name: "Cameron Green", role: "allrounder" },
  { name: "Alastair Cook", role: "batsman" }, { name: "James Anderson", role: "bowler" }, { name: "Stuart Broad", role: "bowler" },
  { name: "Kevin Pietersen", role: "batsman" }, { name: "Eoin Morgan", role: "batsman" }, { name: "Jonny Bairstow", role: "wk" },
  { name: "Jason Roy", role: "batsman" }, { name: "Alex Hales", role: "batsman" }, { name: "Jofra Archer", role: "bowler" },
  { name: "Mark Wood", role: "bowler" }, { name: "Moeen Ali", role: "allrounder" }, { name: "Adil Rashid", role: "bowler" },
  { name: "Andrew Flintoff", role: "allrounder" }, { name: "Ian Botham", role: "allrounder" }, { name: "David Gower", role: "batsman" },
  { name: "Graham Gooch", role: "batsman" }, { name: "Marcus Trescothick", role: "batsman" }, { name: "Andrew Strauss", role: "batsman" },
  { name: "Michael Vaughan", role: "batsman" }, { name: "Graeme Swann", role: "bowler" }, { name: "Monty Panesar", role: "bowler" },
  { name: "Hashim Amla", role: "batsman" }, { name: "Graeme Smith", role: "batsman" }, { name: "Dale Steyn", role: "bowler" },
  { name: "Morne Morkel", role: "bowler" }, { name: "Faf du Plessis", role: "batsman" }, { name: "JP Duminy", role: "allrounder" },
  { name: "Herschelle Gibbs", role: "batsman" }, { name: "Gary Kirsten", role: "batsman" }, { name: "Allan Donald", role: "bowler" },
  { name: "Makhaya Ntini", role: "bowler" }, { name: "Shaun Pollock", role: "allrounder" }, { name: "Lance Klusener", role: "allrounder" },
  { name: "Mark Boucher", role: "wk" }, { name: "Lungi Ngidi", role: "bowler" }, { name: "Anrich Nortje", role: "bowler" },
  { name: "David Miller", role: "batsman" }, { name: "Ross Taylor", role: "batsman" }, { name: "Martin Guptill", role: "batsman" },
  { name: "Brendon McCullum", role: "wk" }, { name: "Stephen Fleming", role: "batsman" }, { name: "Daniel Vettori", role: "allrounder" },
  { name: "Tim Southee", role: "bowler" }, { name: "Richard Hadlee", role: "allrounder" }, { name: "Chris Cairns", role: "allrounder" },
  { name: "Nathan Astle", role: "batsman" }, { name: "Shane Bond", role: "bowler" }, { name: "Corey Anderson", role: "allrounder" },
  { name: "Tom Latham", role: "wk" }, { name: "Devon Conway", role: "batsman" }, { name: "Matt Henry", role: "bowler" },
  { name: "Kyle Jamieson", role: "bowler" }, { name: "Mitchell Santner", role: "allrounder" }, { name: "Imran Khan", role: "allrounder" },
  { name: "Wasim Akram", role: "bowler" }, { name: "Waqar Younis", role: "bowler" }, { name: "Shoaib Akhtar", role: "bowler" },
  { name: "Inzamam-ul-Haq", role: "batsman" }, { name: "Javed Miandad", role: "batsman" }, { name: "Younis Khan", role: "batsman" },
  { name: "Mohammad Yousuf", role: "batsman" }, { name: "Saeed Anwar", role: "batsman" }, { name: "Shahid Afridi", role: "allrounder" },
  { name: "Mohammad Rizwan", role: "wk" }, { name: "Fakhar Zaman", role: "batsman" }, { name: "Haris Rauf", role: "bowler" },
  { name: "Shadab Khan", role: "allrounder" }, { name: "Misbah-ul-Haq", role: "batsman" }, { name: "Shoaib Malik", role: "allrounder" },
  { name: "Umar Gul", role: "bowler" }, { name: "Saqlain Mushtaq", role: "bowler" }, { name: "Abdul Razzaq", role: "allrounder" },
  { name: "Vivian Richards", role: "batsman" }, { name: "Gordon Greenidge", role: "batsman" }, { name: "Desmond Haynes", role: "batsman" },
  { name: "Clive Lloyd", role: "batsman" }, { name: "Shivnarine Chanderpaul", role: "batsman" }, { name: "Kieron Pollard", role: "allrounder" },
  { name: "Jason Holder", role: "allrounder" }, { name: "Andre Russell", role: "allrounder" }, { name: "Dwayne Bravo", role: "allrounder" },
  { name: "Courtney Walsh", role: "bowler" }, { name: "Curtly Ambrose", role: "bowler" }, { name: "Malcolm Marshall", role: "bowler" },
  { name: "Andy Roberts", role: "bowler" }, { name: "Michael Holding", role: "bowler" }, { name: "Ian Bishop", role: "bowler" },
  { name: "Marlon Samuels", role: "batsman" }, { name: "Kumar Sangakkara", role: "wk" }, { name: "Mahela Jayawardene", role: "batsman" },
  { name: "Sanath Jayasuriya", role: "allrounder" }, { name: "Aravinda de Silva", role: "batsman" }, { name: "Chaminda Vaas", role: "bowler" },
  { name: "Tillakaratne Dilshan", role: "batsman" }, { name: "Angelo Mathews", role: "allrounder" }, { name: "Rangana Herath", role: "bowler" },
  { name: "Marvan Atapattu", role: "batsman" }, { name: "Arjuna Ranatunga", role: "batsman" }, { name: "Tamim Iqbal", role: "batsman" },
  { name: "Mushfiqur Rahim", role: "wk" }, { name: "Mahmudullah", role: "allrounder" }, { name: "Mashrafe Mortaza", role: "bowler" },
  { name: "Mustafizur Rahman", role: "bowler" }, { name: "Mohammad Nabi", role: "allrounder" }, { name: "Mujeeb Ur Rahman", role: "bowler" },
  { name: "Rahmanullah Gurbaz", role: "wk" }, { name: "Suryakumar Yadav", role: "batsman" }, { name: "Shreyas Iyer", role: "batsman" },
  { name: "Ishan Kishan", role: "wk" }, { name: "Axar Patel", role: "allrounder" }, { name: "Shubman Gill", role: "batsman" },
  { name: "Mohammed Siraj", role: "bowler" }, { name: "Navdeep Saini", role: "bowler" }, { name: "Kuldeep Yadav", role: "bowler" },
  { name: "Washington Sundar", role: "allrounder" }, { name: "Prithvi Shaw", role: "batsman" }, { name: "Sanju Samson", role: "wk" },
  { name: "Ajinkya Rahane", role: "batsman" }, { name: "Cheteshwar Pujara", role: "batsman" }, { name: "Mayank Agarwal", role: "batsman" },
  { name: "Umesh Yadav", role: "bowler" }, { name: "Deepak Chahar", role: "bowler" }, { name: "Shardul Thakur", role: "bowler" },
  { name: "Bhuvneshwar Kumar", role: "bowler" }
];

function randomRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const statsPath = path.join(__dirname, 'data', 'hiloStats.json');
const players = [];

for(const p of playersData) {
    let testRuns = 0, odiRuns = 0, t20Runs = 0;
    let testWickets = 0, odiWickets = 0, t20Wickets = 0;
    let centuries = 0, matches = randomRange(50, 400);

    if (p.role === 'batsman' || p.role === 'wk') {
        testRuns = randomRange(2000, 12000);
        odiRuns = randomRange(2000, 10000);
        t20Runs = randomRange(500, 4000);
        testWickets = randomRange(0, 10);
        odiWickets = randomRange(0, 15);
        t20Wickets = randomRange(0, 5);
        centuries = randomRange(5, 50);
    } else if (p.role === 'bowler') {
        testRuns = randomRange(100, 1500);
        odiRuns = randomRange(50, 1000);
        t20Runs = randomRange(10, 300);
        testWickets = randomRange(100, 600);
        odiWickets = randomRange(100, 400);
        t20Wickets = randomRange(50, 150);
        centuries = randomRange(0, 1);
    } else if (p.role === 'allrounder') {
        testRuns = randomRange(1500, 6000);
        odiRuns = randomRange(1500, 5000);
        t20Runs = randomRange(400, 2000);
        testWickets = randomRange(50, 300);
        odiWickets = randomRange(50, 250);
        t20Wickets = randomRange(30, 100);
        centuries = randomRange(2, 15);
    }

    players.push({
        "name": p.name,
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
console.log(`Successfully generated ${players.length} authentic international players!`);
