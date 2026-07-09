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

const nameCorrections = {
  "matthew short": "Matt Short",
  "quinton de kock": "Q De Kock",
  "angkrish raghuvanshi": "A Raghuvanshi",
  "nitish kumar reddy": "Nitish Reddy",
  "abhishek porel": "Abishek Porel",
  "dushmantha chameera": "D Chameera",
  "mohammad shami": "Mohd Shami",
  "m. siddharth": "M Siddharth",
  "mitch owen": "Mitchell Owen",
  "yuzvendra chahal": "Y Chahal",
  "v. vijaykumar": "Vyshak Vijaykumar",
  "lhuan-dre pretorius": "Lhuandre Pretorius",
  "vaibhav sooryavanshi": "Vaibhav Suryavanshi"
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
    console.log(`Loaded ${dbPlayers.length} players from Supabase Database.`);

    const dbPlayerMap = {};
    dbPlayers.forEach(p => {
      dbPlayerMap[p.name.toLowerCase().trim()] = p;
    });

    // Helper to find exact or loose match
    function findMatch(rawName) {
      const cleanName = rawName.trim().toLowerCase();
      // 1. Check spelling corrections
      if (nameCorrections[cleanName]) {
        const corrected = nameCorrections[cleanName].toLowerCase().trim();
        if (dbPlayerMap[corrected]) return dbPlayerMap[corrected];
      }
      // 2. Direct map check
      if (dbPlayerMap[cleanName]) return dbPlayerMap[cleanName];

      // 3. Loose search
      const nameParts = cleanName.split(' ');
      const lastName = nameParts[nameParts.length - 1];
      const firstName = nameParts[0];

      for (const [dbName, record] of Object.entries(dbPlayerMap)) {
        const dbParts = dbName.split(' ');
        const dbLastName = dbParts[dbParts.length - 1];
        const dbFirstName = dbParts[0];

        if (dbLastName === lastName && dbFirstName.charAt(0) === firstName.charAt(0)) {
          return record;
        }
      }
      return null;
    }

    const outputPools = {};

    for (const [teamCode, roster] of Object.entries(squads)) {
      const teamPlayers = [];
      const unmatched = [];

      for (const player of roster) {
        const match = findMatch(player.name);
        if (match) {
          teamPlayers.push(match);
        } else {
          unmatched.push(player.name);
        }
      }

      if (unmatched.length > 0) {
        console.warn(`⚠️ Warning: Unmatched players for ${teamCode}:`, unmatched);
      }

      // Sort team players by OVR descending, then name
      teamPlayers.sort((a, b) => b.ovr - a.ovr || a.name.localeCompare(b.name));
      outputPools[teamCode] = teamPlayers;
      console.log(`✅ Loaded ${teamPlayers.length} matched players for ${teamCode}.`);
    }

    const outputPath = path.join(__dirname, '..', 'data', 'ipl_2026_squads_pool.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputPools, null, 2), 'utf-8');
    console.log(`🎉 Successfully wrote ipl_2026_squads_pool.json to ${outputPath}`);

  } catch (err) {
    console.error("Error executing script:", err);
  }
}

run();
