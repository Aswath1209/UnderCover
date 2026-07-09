const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://yjsotgclzaiahobhzupu.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const checkNames = [
  "Jake Fraser-McGurk", "Abhishek Sharma", "Mayank Yadav", "Rachin Ravindra", 
  "Gerald Coetzee", "Phil Salt", "Will Jacks", "Shamar Joseph", 
  "Tristan Stubbs", "Nandre Burger", "Spencer Johnson", "Matheesha Pathirana", 
  "Dilshan Madushanka", "Dunith Wellalage", "Azmatullah Omarzai", "Ibrahim Zadran", 
  "Rahmanullah Gurbaz", "Naveen-ul-Haq", "Fazalhaq Farooqi", "Brandon King", 
  "Sherfane Rutherford", "Akeal Hosein", "Gudakesh Motie", "Romario Shepherd",
  "Harry Brook", "Gus Atkinson", "Shoaib Bashir", "Tom Hartley", "Rehan Ahmed",
  "Sikandar Raza", "Sean Williams", "Craig Ervine", "Blessing Muzarabani", "Richard Ngarava"
];

async function run() {
  const { data: dbPlayers, error } = await supabase
    .from('cricketplayers')
    .select('name');
    
  if (error) {
    console.error(error);
    return;
  }
  
  const dbNames = new Set(dbPlayers.map(p => p.name.toLowerCase()));
  const missing = [];
  
  checkNames.forEach(name => {
    if (!dbNames.has(name.toLowerCase())) {
      missing.push(name);
    }
  });
  
  console.log(`Checked ${checkNames.length} names.`);
  console.log(`Missing from DB: ${missing.length}`);
  console.log(missing);
}

run();
