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
    const dbNames = new Set(dbPlayers.map(p => p.name.toLowerCase().trim()));

    console.log(`Loaded ${dbPlayers.length} players from Supabase Database.`);

    const missing = [];
    const nameDiscrepancies = [];

    // Map database names to full player records for loose matching
    const dbPlayerMap = {};
    dbPlayers.forEach(p => {
      dbPlayerMap[p.name.toLowerCase().trim()] = p;
    });

    // Helper to search database for loose/short matches
    function findLooseMatch(fullName) {
      const nameParts = fullName.toLowerCase().trim().split(' ');
      const lastName = nameParts[nameParts.length - 1];
      const firstName = nameParts[0];

      // Try checking if there is a DB player with the same last name and first letter matches
      for (const [dbName, record] of Object.entries(dbPlayerMap)) {
        const dbParts = dbName.split(' ');
        const dbLastName = dbParts[dbParts.length - 1];
        const dbFirstName = dbParts[0];

        // Match "y chahal" with "yuzvendra chahal"
        if (dbLastName === lastName) {
          if (dbFirstName.charAt(0) === firstName.charAt(0)) {
            return record;
          }
        }
      }
      return null;
    }

    for (const [teamCode, roster] of Object.entries(squads)) {
      for (const player of roster) {
        const nameClean = player.name.toLowerCase().trim();
        if (!dbNames.has(nameClean)) {
          const looseMatch = findLooseMatch(player.name);
          if (looseMatch) {
            nameDiscrepancies.push({
              jsonName: player.name,
              dbName: looseMatch.name,
              team: teamCode,
              ovr: looseMatch.ovr,
              role: looseMatch.role
            });
          } else {
            missing.push({
              name: player.name,
              team: teamCode
            });
          }
        }
      }
    }

    console.log("\n=================== 🔍 Spelling/Name Discrepancies ===================");
    if (nameDiscrepancies.length === 0) {
      console.log("None.");
    } else {
      nameDiscrepancies.forEach(d => {
        console.log(`- ${d.jsonName} (in JSON for ${d.team}) matches DB: "${d.dbName}" (OVR: ${d.ovr}, Role: ${d.role})`);
      });
    }

    console.log("\n=================== ❌ Completely Missing Players ===================");
    if (missing.length === 0) {
      console.log("✅ No completely missing players!");
    } else {
      console.log(`Found ${missing.length} missing players:`);
      missing.forEach((m, idx) => {
        console.log(`${idx + 1}. Name: "${m.name}" | Team: ${m.team}`);
      });
    }

  } catch (err) {
    console.error("Comparison failed:", err);
  }
}

run();
