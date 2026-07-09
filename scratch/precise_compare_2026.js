require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sb = require('../db/supabase');

const gtRoster = [
  "Shubman Gill", "Jos Buttler", "Sai Sudharsan", "Kumar Kushagra", "Anuj Rawat",
  "Tom Banton", "Shahrukh Khan", "Glenn Phillips", "Rahul Tewatia", "Jason Holder",
  "Washington Sundar", "Arshad Khan", "Nishant Sindhu", "Rashid Khan", "Kagiso Rabada",
  "Mohammed Siraj", "Prasidh Krishna", "Ishant Sharma", "Sai Kishore", "Jayant Yadav",
  "Gurnoor Singh Brar", "Luke Wood", "Manav Suthar", "Ashok Sharma", "Prithvi Raj Yarra"
];

const lsgRoster = [
  "Rishabh Pant", "Nicholas Pooran", "Aiden Markram", "Mitchell Marsh", "Wanindu Hasaranga",
  "Anrich Nortje", "Mayank Yadav", "Mohsin Khan", "Avesh Khan", "Mohammad Shami",
  "Ayush Badoni", "Abdul Samad", "Arjun Tendulkar", "Josh Inglis", "Matthew Breetzke",
  "Mukul Choudhary", "Akshat Raghuwanshi", "Himmat Singh", "Arshin Kulkarni", "Akash Singh",
  "Digvesh Singh", "M. Siddharth", "Naman Tiwari", "Prince Yadav"
];

const pbksRoster = [
  "Shreyas Iyer", "Prabhsimran Singh", "Shashank Singh", "Nehal Wadhera", "Priyansh Arya",
  "Marcus Stoinis", "Marco Jansen", "Harpreet Brar", "Azmatullah Omarzai", "Cooper Connolly",
  "Musheer Khan", "Mitch Owen", "Suryansh Shedge", "Arshdeep Singh", "Yuzvendra Chahal",
  "Lockie Ferguson", "Ben Dwarshuis", "Pravin Dubey", "Yash Thakur", "V. Vijaykumar",
  "Xavier Bartlett", "Bevon Jacobs"
];

const rrRoster = [
  "Riyan Parag", "Yashasvi Jaiswal", "Shimron Hetmyer", "Shubham Dubey", "Vaibhav Sooryavanshi",
  "Lhuan-dre Pretorius", "Ravindra Jadeja", "Sam Curran", "Donovan Ferreira", "Dasun Shanaka",
  "Yudhvir Singh Charak", "Jofra Archer", "Sandeep Sharma", "Tushar Deshpande", "Adam Milne",
  "Kwena Maphaka", "Nandre Burger", "Kuldeep Sen", "Ravi Bishnoi", "Dhruv Jurel"
];

// Manually verified name mapping of variants/abbreviations in database
const dbNameAliases = {
  "varun chakaravarthy": "varun chakravarthy",
  "yuzvendra chahal": "y chahal",
  "quinton de kock": "q de kock",
  "mohammad shami": "mohd shami",
  "mitch owen": "mitchell owen",
  "lhuan-dre pretorius": "lhuandre pretorius",
  "m. siddharth": "m siddharth",
  "abhishek porel": "abishek porel",
  "dushmantha chameera": "d chameera",
  "nitish kumar reddy": "nitish reddy",
  "shreyas iyer": "shreyas iyer", // Let's check exact names
  "axar patel": "axar patel",
  "kl rahul": "kl rahul",
  "shivam dubi": "shivam dube",
  "ms dhoni": "ms dhoni",
  "hardik pandya": "hardik pandya",
  "matthew short": "matt short",
  "v. vijaykumar": "vyshak vijaykumar"
};

async function run() {
  if (!sb.supabase) {
    console.error("Supabase client not initialized.");
    return;
  }

  try {
    const scrapedPath = path.join(__dirname, 'ipl_2026_scraped.json');
    const squads = JSON.parse(fs.readFileSync(scrapedPath, 'utf8'));

    // Inject manual rosters
    squads['GT'] = gtRoster.map(name => ({ name }));
    squads['LSG'] = lsgRoster.map(name => ({ name }));
    squads['PBKS'] = pbksRoster.map(name => ({ name }));
    squads['RR'] = rrRoster.map(name => ({ name }));

    const dbPlayers = await sb.getCricketPlayers();
    const dbNamesLower = new Set(dbPlayers.map(p => p.name.toLowerCase().trim()));

    // Create lookup by lower name
    const dbPlayerMap = {};
    dbPlayers.forEach(p => {
      dbPlayerMap[p.name.toLowerCase().trim()] = p;
    });

    console.log(`Loaded ${dbPlayers.length} players from Supabase Database.`);

    const missing = [];
    const verifiedMatches = [];

    for (const [teamCode, roster] of Object.entries(squads)) {
      for (const player of roster) {
        const jsonNameClean = player.name.toLowerCase().trim();
        
        // 1. Direct match
        if (dbNamesLower.has(jsonNameClean)) {
          verifiedMatches.push({ jsonName: player.name, dbName: dbPlayerMap[jsonNameClean].name, team: teamCode });
          continue;
        }

        // 2. Alias match
        const alias = dbNameAliases[jsonNameClean];
        if (alias && dbNamesLower.has(alias)) {
          verifiedMatches.push({ jsonName: player.name, dbName: dbPlayerMap[alias].name, team: teamCode });
          continue;
        }

        // 3. Abbreviated first name check (e.g., "S Iyer" for "Shreyas Iyer", or "K Rabada" for "Kagiso Rabada")
        const nameParts = jsonNameClean.split(' ');
        const lastName = nameParts[nameParts.length - 1];
        const firstInitial = nameParts[0].charAt(0);
        const abbreviatedName = `${firstInitial} ${lastName}`;

        if (dbNamesLower.has(abbreviatedName)) {
          verifiedMatches.push({ jsonName: player.name, dbName: dbPlayerMap[abbreviatedName].name, team: teamCode });
          continue;
        }

        // Otherwise, it is missing
        missing.push({
          name: player.name,
          team: teamCode
        });
      }
    }

    console.log(`\nVerified matches: ${verifiedMatches.length}`);
    console.log(`Missing players: ${missing.length}`);

    console.log("\n=================== ❌ COMPLETELY MISSING PLAYERS (IPL 2026) ===================");
    const teamGroups = {};
    missing.forEach(m => {
      if (!teamGroups[m.team]) teamGroups[m.team] = [];
      teamGroups[m.team].push(m.name);
    });

    for (const [team, players] of Object.entries(teamGroups)) {
      console.log(`\n📍 Team: ${team} (${players.length} missing):`);
      players.forEach((name, idx) => {
        console.log(`  ${idx + 1}. "${name}"`);
      });
    }

  } catch (err) {
    console.error("Comparison failed:", err);
  }
}

run();
