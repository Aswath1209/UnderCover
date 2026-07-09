const fs = require('fs');
const path = require('path');

const iplTeams = {
  CSK: {
    name: "Chennai Super Kings",
    logo: "🦁",
    roster: [
      { name: "Ruturaj Gaikwad", role: "Batsman", ovr: 89, bat: 91, bowl: 10, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Rachin Ravindra", role: "Batsman", ovr: 83, bat: 84, bowl: 65, batting_hand: "left", batting_archetype: "Opener", bowler_type: "off_spin" },
      { name: "Daryl Mitchell", role: "Batsman", ovr: 84, bat: 85, bowl: 50, batting_hand: "right", batting_archetype: "Anchor", bowler_type: "fast" },
      { name: "Shivam Dube", role: "Batsman", ovr: 86, bat: 88, bowl: 55, batting_hand: "left", batting_archetype: "Brute", bowler_type: "fast" },
      { name: "Ravindra Jadeja", role: "All-Rounder", ovr: 90, bat: 84, bowl: 91, batting_hand: "left", batting_archetype: "Finisher", bowler_type: "off_spin" },
      { name: "MS Dhoni", role: "Wicketkeeper", ovr: 85, bat: 84, bowl: 0, batting_hand: "right", batting_archetype: "Finisher" },
      { name: "Sameer Rizvi", role: "Batsman", ovr: 75, bat: 76, bowl: 0, batting_hand: "right", batting_archetype: "Brute" },
      { name: "Deepak Chahar", role: "Bowler", ovr: 81, bat: 55, bowl: 82, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Shardul Thakur", role: "Bowler", ovr: 80, bat: 58, bowl: 80, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Matheesha Pathirana", role: "Bowler", ovr: 88, bat: 10, bowl: 91, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Maheesh Theekshana", role: "Bowler", ovr: 82, bat: 10, bowl: 84, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "off_spin" }
    ]
  },
  RCB: {
    name: "Royal Challengers Bengaluru",
    logo: "👑",
    roster: [
      { name: "Virat Kohli", role: "Batsman", ovr: 93, bat: 95, bowl: 15, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Faf du Plessis", role: "Batsman", ovr: 85, bat: 86, bowl: 10, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Will Jacks", role: "Batsman", ovr: 85, bat: 86, bowl: 65, batting_hand: "right", batting_archetype: "Brute", bowler_type: "off_spin" },
      { name: "Rajat Patidar", role: "Batsman", ovr: 83, bat: 85, bowl: 0, batting_hand: "right", batting_archetype: "Anchor" },
      { name: "Glenn Maxwell", role: "All-Rounder", ovr: 88, bat: 86, bowl: 84, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "off_spin" },
      { name: "Cameron Green", role: "All-Rounder", ovr: 86, bat: 85, bowl: 81, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "fast" },
      { name: "Dinesh Karthik", role: "Wicketkeeper", ovr: 83, bat: 84, bowl: 0, batting_hand: "right", batting_archetype: "Finisher" },
      { name: "Mahipal Lomror", role: "Batsman", ovr: 77, bat: 78, bowl: 30, batting_hand: "left", batting_archetype: "Brute" },
      { name: "Karn Sharma", role: "Bowler", ovr: 79, bat: 45, bowl: 80, batting_hand: "left", batting_archetype: "Tailender", bowler_type: "leg_spin" },
      { name: "Mohammed Siraj", role: "Bowler", ovr: 86, bat: 15, bowl: 88, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Yash Dayal", role: "Bowler", ovr: 81, bat: 10, bowl: 82, batting_hand: "left", batting_archetype: "Tailender", bowler_type: "fast" }
    ]
  },
  MI: {
    name: "Mumbai Indians",
    logo: "🛡️",
    roster: [
      { name: "Rohit Sharma", role: "Batsman", ovr: 90, bat: 91, bowl: 10, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Ishan Kishan", role: "Wicketkeeper", ovr: 84, bat: 85, bowl: 0, batting_hand: "left", batting_archetype: "Opener" },
      { name: "Suryakumar Yadav", role: "Batsman", ovr: 92, bat: 95, bowl: 0, batting_hand: "right", batting_archetype: "Brute" },
      { name: "Tilak Varma", role: "Batsman", ovr: 84, bat: 85, bowl: 40, batting_hand: "left", batting_archetype: "Anchor" },
      { name: "Hardik Pandya", role: "All-Rounder", ovr: 89, bat: 85, bowl: 87, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "fast" },
      { name: "Tim David", role: "Batsman", ovr: 81, bat: 83, bowl: 0, batting_hand: "right", batting_archetype: "Brute" },
      { name: "Romario Shepherd", role: "All-Rounder", ovr: 78, bat: 76, bowl: 78, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "fast" },
      { name: "Gerald Coetzee", role: "Bowler", ovr: 82, bat: 25, bowl: 84, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Piyush Chawla", role: "Bowler", ovr: 81, bat: 35, bowl: 82, batting_hand: "left", batting_archetype: "Tailender", bowler_type: "leg_spin" },
      { name: "Jasprit Bumrah", role: "Bowler", ovr: 97, bat: 15, bowl: 98, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Nuwan Thushara", role: "Bowler", ovr: 80, bat: 5, bowl: 82, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" }
    ]
  },
  PBKS: {
    name: "Punjab Kings",
    logo: "🦁",
    roster: [
      { name: "Prabhsimran Singh", role: "Batsman", ovr: 78, bat: 80, bowl: 0, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Jonny Bairstow", role: "Batsman", ovr: 84, bat: 85, bowl: 0, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Rilee Rossouw", role: "Batsman", ovr: 80, bat: 82, bowl: 0, batting_hand: "left", batting_archetype: "Anchor" },
      { name: "Liam Livingstone", role: "All-Rounder", ovr: 84, bat: 83, bowl: 78, batting_hand: "right", batting_archetype: "Brute", bowler_type: "leg_spin" },
      { name: "Sam Curran", role: "All-Rounder", ovr: 85, bat: 83, bowl: 84, batting_hand: "left", batting_archetype: "Finisher", bowler_type: "fast" },
      { name: "Jitesh Sharma", role: "Wicketkeeper", ovr: 78, bat: 79, bowl: 0, batting_hand: "right", batting_archetype: "Finisher" },
      { name: "Shashank Singh", role: "Batsman", ovr: 82, bat: 84, bowl: 10, batting_hand: "right", batting_archetype: "Finisher" },
      { name: "Ashutosh Sharma", role: "Batsman", ovr: 80, bat: 82, bowl: 0, batting_hand: "right", batting_archetype: "Finisher" },
      { name: "Harshal Patel", role: "Bowler", ovr: 83, bat: 30, bowl: 85, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Kagiso Rabada", role: "Bowler", ovr: 87, bat: 15, bowl: 89, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Arshdeep Singh", role: "Bowler", ovr: 85, bat: 10, bowl: 87, batting_hand: "left", batting_archetype: "Tailender", bowler_type: "fast" }
    ]
  },
  KKR: {
    name: "Kolkata Knight Riders",
    logo: "🔮",
    roster: [
      { name: "Phil Salt", role: "Wicketkeeper", ovr: 86, bat: 88, bowl: 0, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Sunil Narine", role: "All-Rounder", ovr: 90, bat: 84, bowl: 91, batting_hand: "left", batting_archetype: "Opener", bowler_type: "off_spin" },
      { name: "Venkatesh Iyer", role: "Batsman", ovr: 82, bat: 83, bowl: 50, batting_hand: "left", batting_archetype: "Anchor", bowler_type: "fast" },
      { name: "Shreyas Iyer", role: "Batsman", ovr: 85, bat: 86, bowl: 10, batting_hand: "right", batting_archetype: "Anchor" },
      { name: "Rinku Singh", role: "Batsman", ovr: 84, bat: 85, bowl: 0, batting_hand: "left", batting_archetype: "Finisher" },
      { name: "Andre Russell", role: "All-Rounder", ovr: 91, bat: 88, bowl: 89, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "fast" },
      { name: "Ramandeep Singh", role: "Batsman", ovr: 76, bat: 77, bowl: 40, batting_hand: "right", batting_archetype: "Finisher" },
      { name: "Mitchell Starc", role: "Bowler", ovr: 89, bat: 25, bowl: 90, batting_hand: "left", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Harshit Rana", role: "Bowler", ovr: 82, bat: 20, bowl: 83, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Varun Chakaravarthy", role: "Bowler", ovr: 85, bat: 5, bowl: 87, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "off_spin" },
      { name: "Vaibhav Arora", role: "Bowler", ovr: 79, bat: 5, bowl: 81, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" }
    ]
  },
  RR: {
    name: "Rajasthan Royals",
    logo: "👑",
    roster: [
      { name: "Yashasvi Jaiswal", role: "Batsman", ovr: 88, bat: 90, bowl: 10, batting_hand: "left", batting_archetype: "Opener" },
      { name: "Jos Buttler", role: "Wicketkeeper", ovr: 90, bat: 91, bowl: 0, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Sanju Samson", role: "Batsman", ovr: 87, bat: 88, bowl: 0, batting_hand: "right", batting_archetype: "Anchor" },
      { name: "Riyan Parag", role: "Batsman", ovr: 83, bat: 85, bowl: 55, batting_hand: "right", batting_archetype: "Brute", bowler_type: "leg_spin" },
      { name: "Shimron Hetmyer", role: "Batsman", ovr: 82, bat: 83, bowl: 0, batting_hand: "left", batting_archetype: "Finisher" },
      { name: "Dhruv Jurel", role: "Batsman", ovr: 80, bat: 81, bowl: 0, batting_hand: "right", batting_archetype: "Finisher" },
      { name: "Ravichandran Ashwin", role: "All-Rounder", ovr: 85, bat: 70, bowl: 86, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "off_spin" },
      { name: "Trent Boult", role: "Bowler", ovr: 88, bat: 15, bowl: 90, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Sandeep Sharma", role: "Bowler", ovr: 82, bat: 10, bowl: 83, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Avesh Khan", role: "Bowler", ovr: 81, bat: 10, bowl: 82, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Yuzvendra Chahal", role: "Bowler", ovr: 86, bat: 5, bowl: 88, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "leg_spin" }
    ]
  },
  SRH: {
    name: "Sunrisers Hyderabad",
    logo: "🧡",
    roster: [
      { name: "Travis Head", role: "Batsman", ovr: 91, bat: 93, bowl: 40, batting_hand: "left", batting_archetype: "Opener", bowler_type: "off_spin" },
      { name: "Abhishek Sharma", role: "Batsman", ovr: 85, bat: 87, bowl: 50, batting_hand: "left", batting_archetype: "Opener", bowler_type: "off_spin" },
      { name: "Nitish Reddy", role: "All-Rounder", ovr: 80, bat: 81, bowl: 76, batting_hand: "right", batting_archetype: "Anchor", bowler_type: "fast" },
      { name: "Heinrich Klaasen", role: "Wicketkeeper", ovr: 91, bat: 93, bowl: 0, batting_hand: "right", batting_archetype: "Brute" },
      { name: "Aiden Markram", role: "Batsman", ovr: 84, bat: 85, bowl: 55, batting_hand: "right", batting_archetype: "Anchor", bowler_type: "off_spin" },
      { name: "Abdul Samad", role: "Batsman", ovr: 77, bat: 78, bowl: 0, batting_hand: "right", batting_archetype: "Brute" },
      { name: "Shahbaz Ahmed", role: "All-Rounder", ovr: 79, bat: 75, bowl: 80, batting_hand: "left", batting_archetype: "Finisher", bowler_type: "left_arm_orthodox" },
      { name: "Pat Cummins", role: "All-Rounder", ovr: 91, bat: 70, bowl: 92, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Bhuvneshwar Kumar", role: "Bowler", ovr: 83, bat: 30, bowl: 84, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Jaydev Unadkat", role: "Bowler", ovr: 78, bat: 20, bowl: 79, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "T Natarajan", role: "Bowler", ovr: 83, bat: 5, bowl: 85, batting_hand: "left", batting_archetype: "Tailender", bowler_type: "fast" }
    ]
  },
  LSG: {
    name: "Lucknow Super Giants",
    logo: "🛡️",
    roster: [
      { name: "KL Rahul", role: "Wicketkeeper", ovr: 87, bat: 88, bowl: 0, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Quinton de Kock", role: "Batsman", ovr: 85, bat: 86, bowl: 0, batting_hand: "left", batting_archetype: "Opener" },
      { name: "Marcus Stoinis", role: "All-Rounder", ovr: 86, bat: 85, bowl: 82, batting_hand: "right", batting_archetype: "Brute", bowler_type: "fast" },
      { name: "Nicholas Pooran", role: "Batsman", ovr: 88, bat: 90, bowl: 0, batting_hand: "left", batting_archetype: "Brute" },
      { name: "Deepak Hooda", role: "Batsman", ovr: 79, bat: 80, bowl: 45, batting_hand: "right", batting_archetype: "Anchor", bowler_type: "off_spin" },
      { name: "Ayush Badoni", role: "Batsman", ovr: 78, bat: 79, bowl: 0, batting_hand: "right", batting_archetype: "Finisher" },
      { name: "Krunal Pandya", role: "All-Rounder", ovr: 82, bat: 78, bowl: 83, batting_hand: "left", batting_archetype: "Finisher", bowler_type: "left_arm_orthodox" },
      { name: "Ravi Bishnoi", role: "Bowler", ovr: 84, bat: 10, bowl: 86, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "leg_spin" },
      { name: "Mohsin Khan", role: "Bowler", ovr: 80, bat: 5, bowl: 81, batting_hand: "left", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Naveen-ul-Haq", role: "Bowler", ovr: 82, bat: 10, bowl: 83, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Mayank Yadav", role: "Bowler", ovr: 83, bat: 5, bowl: 85, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" }
    ]
  },
  GT: {
    name: "Gujarat Titans",
    logo: "⚡",
    roster: [
      { name: "Shubman Gill", role: "Batsman", ovr: 89, bat: 91, bowl: 5, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Wriddhiman Saha", role: "Wicketkeeper", ovr: 78, bat: 79, bowl: 0, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Sai Sudharsan", role: "Batsman", ovr: 83, bat: 85, bowl: 0, batting_hand: "left", batting_archetype: "Anchor" },
      { name: "David Miller", role: "Batsman", ovr: 85, bat: 86, bowl: 0, batting_hand: "left", batting_archetype: "Brute" },
      { name: "Shahrukh Khan", role: "Batsman", ovr: 77, bat: 78, bowl: 30, batting_hand: "right", batting_archetype: "Brute" },
      { name: "Rahul Tewatia", role: "All-Rounder", ovr: 80, bat: 78, bowl: 79, batting_hand: "left", batting_archetype: "Finisher", bowler_type: "leg_spin" },
      { name: "Rashid Khan", role: "All-Rounder", ovr: 91, bat: 70, bowl: 93, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "leg_spin" },
      { name: "Sai Kishore", role: "Bowler", ovr: 79, bat: 20, bowl: 80, batting_hand: "left", batting_archetype: "Tailender", bowler_type: "left_arm_orthodox" },
      { name: "Mohit Sharma", role: "Bowler", ovr: 81, bat: 10, bowl: 82, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Spencer Johnson", role: "Bowler", ovr: 80, bat: 10, bowl: 81, batting_hand: "left", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Noor Ahmad", role: "Bowler", ovr: 82, bat: 5, bowl: 84, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "leg_spin" }
    ]
  },
  DC: {
    name: "Delhi Capitals",
    logo: "🛡️",
    roster: [
      { name: "Jake Fraser-McGurk", role: "Batsman", ovr: 83, bat: 86, bowl: 0, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Abishek Porel", role: "Batsman", ovr: 77, bat: 79, bowl: 0, batting_hand: "left", batting_archetype: "Opener" },
      { name: "Shai Hope", role: "Batsman", ovr: 81, bat: 82, bowl: 0, batting_hand: "right", batting_archetype: "Anchor" },
      { name: "Rishabh Pant", role: "Wicketkeeper", ovr: 88, bat: 89, bowl: 0, batting_hand: "left", batting_archetype: "Brute" },
      { name: "Tristan Stubbs", role: "Batsman", ovr: 84, bat: 86, bowl: 25, batting_hand: "right", batting_archetype: "Finisher" },
      { name: "Axar Patel", role: "All-Rounder", ovr: 88, bat: 82, bowl: 89, batting_hand: "left", batting_archetype: "Finisher", bowler_type: "left_arm_orthodox" },
      { name: "Lalit Yadav", role: "All-Rounder", ovr: 75, bat: 74, bowl: 75, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "off_spin" },
      { name: "Kuldeep Yadav", role: "Bowler", ovr: 88, bat: 30, bowl: 90, batting_hand: "left", batting_archetype: "Tailender", bowler_type: "leg_spin" },
      { name: "Rasikh Salam", role: "Bowler", ovr: 78, bat: 10, bowl: 79, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Khaleel Ahmed", role: "Bowler", ovr: 82, bat: 5, bowl: 83, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Mukesh Kumar", role: "Bowler", ovr: 81, bat: 5, bowl: 82, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" }
    ]
  }
};

const wcTeams = {
  IND: {
    name: "India",
    logo: "🇮🇳",
    roster: [
      { name: "Rohit Sharma", role: "Batsman", ovr: 91, bat: 92, bowl: 10, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Virat Kohli", role: "Batsman", ovr: 94, bat: 95, bowl: 20, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Rishabh Pant", role: "Wicketkeeper", ovr: 88, bat: 89, bowl: 0, batting_hand: "left", batting_archetype: "Brute" },
      { name: "Suryakumar Yadav", role: "Batsman", ovr: 92, bat: 95, bowl: 0, batting_hand: "right", batting_archetype: "Brute" },
      { name: "Shivam Dube", role: "Batsman", ovr: 83, bat: 84, bowl: 40, batting_hand: "left", batting_archetype: "Brute", bowler_type: "fast" },
      { name: "Hardik Pandya", role: "All-Rounder", ovr: 89, bat: 86, bowl: 87, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "fast" },
      { name: "Ravindra Jadeja", role: "All-Rounder", ovr: 88, bat: 81, bowl: 89, batting_hand: "left", batting_archetype: "Finisher", bowler_type: "off_spin" },
      { name: "Axar Patel", role: "All-Rounder", ovr: 87, bat: 80, bowl: 88, batting_hand: "left", batting_archetype: "Finisher", bowler_type: "left_arm_orthodox" },
      { name: "Arshdeep Singh", role: "Bowler", ovr: 85, bat: 10, bowl: 87, batting_hand: "left", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Jasprit Bumrah", role: "Bowler", ovr: 97, bat: 15, bowl: 98, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Mohammed Siraj", role: "Bowler", ovr: 85, bat: 10, bowl: 86, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" }
    ]
  },
  AUS: {
    name: "Australia",
    logo: "🇦🇺",
    roster: [
      { name: "Travis Head", role: "Batsman", ovr: 93, bat: 95, bowl: 30, batting_hand: "left", batting_archetype: "Opener", bowler_type: "off_spin" },
      { name: "David Warner", role: "Batsman", ovr: 86, bat: 88, bowl: 0, batting_hand: "left", batting_archetype: "Opener" },
      { name: "Mitchell Marsh", role: "All-Rounder", ovr: 85, bat: 84, bowl: 80, batting_hand: "right", batting_archetype: "Anchor", bowler_type: "fast" },
      { name: "Glenn Maxwell", role: "All-Rounder", ovr: 88, bat: 86, bowl: 84, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "off_spin" },
      { name: "Marcus Stoinis", role: "All-Rounder", ovr: 86, bat: 85, bowl: 83, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "fast" },
      { name: "Tim David", role: "Batsman", ovr: 81, bat: 83, bowl: 0, batting_hand: "right", batting_archetype: "Brute" },
      { name: "Matthew Wade", role: "Wicketkeeper", ovr: 80, bat: 81, bowl: 0, batting_hand: "left", batting_archetype: "Finisher" },
      { name: "Pat Cummins", role: "All-Rounder", ovr: 91, bat: 50, bowl: 92, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Mitchell Starc", role: "Bowler", ovr: 90, bat: 25, bowl: 92, batting_hand: "left", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Josh Hazlewood", role: "Bowler", ovr: 88, bat: 10, bowl: 89, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Adam Zampa", role: "Bowler", ovr: 89, bat: 5, bowl: 91, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "leg_spin" }
    ]
  },
  PAK: {
    name: "Pakistan",
    logo: "🇵🇰",
    roster: [
      { name: "Babar Azam", role: "Batsman", ovr: 90, bat: 92, bowl: 0, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Mohammad Rizwan", role: "Wicketkeeper", ovr: 88, bat: 89, bowl: 0, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Fakhar Zaman", role: "Batsman", ovr: 82, bat: 84, bowl: 10, batting_hand: "left", batting_archetype: "Brute" },
      { name: "Usman Khan", role: "Batsman", ovr: 77, bat: 78, bowl: 0, batting_hand: "right", batting_archetype: "Anchor" },
      { name: "Iftikhar Ahmed", role: "Batsman", ovr: 79, bat: 80, bowl: 60, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "off_spin" },
      { name: "Imad Wasim", role: "All-Rounder", ovr: 83, bat: 75, bowl: 84, batting_hand: "left", batting_archetype: "Finisher", bowler_type: "left_arm_orthodox" },
      { name: "Shadab Khan", role: "All-Rounder", ovr: 84, bat: 79, bowl: 84, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "leg_spin" },
      { name: "Shaheen Afridi", role: "Bowler", ovr: 90, bat: 30, bowl: 92, batting_hand: "left", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Naseem Shah", role: "Bowler", ovr: 86, bat: 20, bowl: 87, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Haris Rauf", role: "Bowler", ovr: 84, bat: 10, bowl: 86, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Mohammad Amir", role: "Bowler", ovr: 84, bat: 10, bowl: 85, batting_hand: "left", batting_archetype: "Tailender", bowler_type: "fast" }
    ]
  },
  ENG: {
    name: "England",
    logo: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    roster: [
      { name: "Jos Buttler", role: "Wicketkeeper", ovr: 90, bat: 91, bowl: 0, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Phil Salt", role: "Batsman", ovr: 86, bat: 88, bowl: 0, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Will Jacks", role: "Batsman", ovr: 84, bat: 85, bowl: 60, batting_hand: "right", batting_archetype: "Brute", bowler_type: "off_spin" },
      { name: "Jonny Bairstow", role: "Batsman", ovr: 83, bat: 84, bowl: 0, batting_hand: "right", batting_archetype: "Anchor" },
      { name: "Harry Brook", role: "Batsman", ovr: 85, bat: 86, bowl: 0, batting_hand: "right", batting_archetype: "Brute" },
      { name: "Moeen Ali", role: "All-Rounder", ovr: 83, bat: 80, bowl: 82, batting_hand: "left", batting_archetype: "Finisher", bowler_type: "off_spin" },
      { name: "Liam Livingstone", role: "All-Rounder", ovr: 83, bat: 82, bowl: 78, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "leg_spin" },
      { name: "Sam Curran", role: "All-Rounder", ovr: 84, bat: 81, bowl: 84, batting_hand: "left", batting_archetype: "Finisher", bowler_type: "fast" },
      { name: "Jofra Archer", role: "Bowler", ovr: 86, bat: 20, bowl: 88, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Adil Rashid", role: "Bowler", ovr: 87, bat: 15, bowl: 89, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "leg_spin" },
      { name: "Reece Topley", role: "Bowler", ovr: 81, bat: 5, bowl: 83, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" }
    ]
  },
  SA: {
    name: "South Africa",
    logo: "🇿🇦",
    roster: [
      { name: "Quinton de Kock", role: "Wicketkeeper", ovr: 87, bat: 89, bowl: 0, batting_hand: "left", batting_archetype: "Opener" },
      { name: "Reeza Hendricks", role: "Batsman", ovr: 81, bat: 82, bowl: 0, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Aiden Markram", role: "Batsman", ovr: 85, bat: 86, bowl: 55, batting_hand: "right", batting_archetype: "Anchor", bowler_type: "off_spin" },
      { name: "Heinrich Klaasen", role: "Batsman", ovr: 91, bat: 93, bowl: 0, batting_hand: "right", batting_archetype: "Brute" },
      { name: "David Miller", role: "Batsman", ovr: 86, bat: 87, bowl: 0, batting_hand: "left", batting_archetype: "Brute" },
      { name: "Tristan Stubbs", role: "Batsman", ovr: 83, bat: 84, bowl: 10, batting_hand: "right", batting_archetype: "Finisher" },
      { name: "Marco Jansen", role: "All-Rounder", ovr: 85, bat: 75, bowl: 86, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "fast" },
      { name: "Keshav Maharaj", role: "Bowler", ovr: 85, bat: 30, bowl: 87, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "left_arm_orthodox" },
      { name: "Kagiso Rabada", role: "Bowler", ovr: 88, bat: 15, bowl: 90, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Anrich Nortje", role: "Bowler", ovr: 84, bat: 10, bowl: 86, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Ottneil Baartman", role: "Bowler", ovr: 80, bat: 5, bowl: 82, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" }
    ]
  },
  NZ: {
    name: "New Zealand",
    logo: "🇳🇿",
    roster: [
      { name: "Devon Conway", role: "Wicketkeeper", ovr: 86, bat: 88, bowl: 0, batting_hand: "left", batting_archetype: "Opener" },
      { name: "Finn Allen", role: "Batsman", ovr: 82, bat: 84, bowl: 0, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Kane Williamson", role: "Batsman", ovr: 90, bat: 92, bowl: 5, batting_hand: "right", batting_archetype: "Anchor" },
      { name: "Daryl Mitchell", role: "Batsman", ovr: 85, bat: 86, bowl: 45, batting_hand: "right", batting_archetype: "Anchor", bowler_type: "fast" },
      { name: "Glenn Phillips", role: "Batsman", ovr: 84, bat: 85, bowl: 65, batting_hand: "right", batting_archetype: "Brute", bowler_type: "off_spin" },
      { name: "James Neesham", role: "All-Rounder", ovr: 81, bat: 80, bowl: 79, batting_hand: "left", batting_archetype: "Finisher", bowler_type: "fast" },
      { name: "Mitchell Santner", role: "All-Rounder", ovr: 85, bat: 75, bowl: 86, batting_hand: "left", batting_archetype: "Finisher", bowler_type: "left_arm_orthodox" },
      { name: "Trent Boult", role: "Bowler", ovr: 88, bat: 15, bowl: 90, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Matt Henry", role: "Bowler", ovr: 84, bat: 15, bowl: 86, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Lockie Ferguson", role: "Bowler", ovr: 83, bat: 10, bowl: 85, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Ish Sodhi", role: "Bowler", ovr: 80, bat: 10, bowl: 82, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "leg_spin" }
    ]
  },
  WI: {
    name: "West Indies",
    logo: "🌴",
    roster: [
      { name: "Brandon King", role: "Batsman", ovr: 81, bat: 83, bowl: 0, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Johnson Charles", role: "Batsman", ovr: 79, bat: 81, bowl: 0, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Nicholas Pooran", role: "Wicketkeeper", ovr: 89, bat: 91, bowl: 0, batting_hand: "left", batting_archetype: "Brute" },
      { name: "Roston Chase", role: "All-Rounder", ovr: 82, bat: 80, bowl: 81, batting_hand: "right", batting_archetype: "Anchor", bowler_type: "off_spin" },
      { name: "Rovman Powell", role: "Batsman", ovr: 82, bat: 83, bowl: 20, batting_hand: "right", batting_archetype: "Brute" },
      { name: "Sherfane Rutherford", role: "Batsman", ovr: 78, bat: 80, bowl: 0, batting_hand: "left", batting_archetype: "Finisher" },
      { name: "Andre Russell", role: "All-Rounder", ovr: 91, bat: 88, bowl: 89, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "fast" },
      { name: "Romario Shepherd", role: "All-Rounder", ovr: 79, bat: 77, bowl: 79, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "fast" },
      { name: "Akeal Hosein", role: "Bowler", ovr: 84, bat: 30, bowl: 86, batting_hand: "left", batting_archetype: "Tailender", bowler_type: "left_arm_orthodox" },
      { name: "Alzarri Joseph", role: "Bowler", ovr: 83, bat: 15, bowl: 85, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Gudakesh Motie", role: "Bowler", ovr: 82, bat: 10, bowl: 84, batting_hand: "left", batting_archetype: "Tailender", bowler_type: "left_arm_orthodox" }
    ]
  },
  AFG: {
    name: "Afghanistan",
    logo: "🇦🇫",
    roster: [
      { name: "Rahmanullah Gurbaz", role: "Wicketkeeper", ovr: 85, bat: 87, bowl: 0, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Ibrahim Zadran", role: "Batsman", ovr: 82, bat: 84, bowl: 0, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Gulbadin Naib", role: "All-Rounder", ovr: 80, bat: 79, bowl: 78, batting_hand: "right", batting_archetype: "Brute", bowler_type: "fast" },
      { name: "Azmatullah Omarzai", role: "All-Rounder", ovr: 82, bat: 81, bowl: 81, batting_hand: "right", batting_archetype: "Anchor", bowler_type: "fast" },
      { name: "Mohammad Nabi", role: "All-Rounder", ovr: 85, bat: 80, bowl: 85, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "off_spin" },
      { name: "Najibullah Zadran", role: "Batsman", ovr: 78, bat: 79, bowl: 0, batting_hand: "left", batting_archetype: "Brute" },
      { name: "Karim Janat", role: "All-Rounder", ovr: 76, bat: 75, bowl: 76, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "fast" },
      { name: "Rashid Khan", role: "All-Rounder", ovr: 91, bat: 72, bowl: 93, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "leg_spin" },
      { name: "Naveen-ul-Haq", role: "Bowler", ovr: 82, bat: 10, bowl: 84, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Fazalhaq Farooqi", role: "Bowler", ovr: 85, bat: 5, bowl: 87, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Noor Ahmad", role: "Bowler", ovr: 81, bat: 5, bowl: 83, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "leg_spin" }
    ]
  },
  ZIM: {
    name: "Zimbabwe",
    logo: "🇿🇼",
    roster: [
      { name: "Sikandar Raza", role: "All-Rounder", ovr: 85, bat: 84, bowl: 83, batting_hand: "right", batting_archetype: "Anchor", bowler_type: "off_spin" },
      { name: "Sean Williams", role: "All-Rounder", ovr: 81, bat: 81, bowl: 76, batting_hand: "left", batting_archetype: "Anchor", bowler_type: "left_arm_orthodox" },
      { name: "Craig Ervine", role: "Batsman", ovr: 79, bat: 80, bowl: 10, batting_hand: "left", batting_archetype: "Opener" },
      { name: "Innocent Kaia", role: "Batsman", ovr: 70, bat: 71, bowl: 0, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Ryan Burl", role: "All-Rounder", ovr: 78, bat: 76, bowl: 77, batting_hand: "left", batting_archetype: "Finisher", bowler_type: "leg_spin" },
      { name: "Clive Madande", role: "Wicketkeeper", ovr: 67, bat: 66, bowl: 0, batting_hand: "right", batting_archetype: "Finisher" },
      { name: "Luke Jongwe", role: "All-Rounder", ovr: 74, bat: 70, bowl: 75, batting_hand: "right", batting_archetype: "Finisher", bowler_type: "fast" },
      { name: "Wellington Masakadza", role: "Bowler", ovr: 75, bat: 45, bowl: 76, batting_hand: "left", batting_archetype: "Tailender", bowler_type: "left_arm_orthodox" },
      { name: "Blessing Muzarabani", role: "Bowler", ovr: 82, bat: 20, bowl: 83, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Richard Ngarava", role: "Bowler", ovr: 78, bat: 15, bowl: 79, batting_hand: "left", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Tendai Chatara", role: "Bowler", ovr: 76, bat: 10, bowl: 77, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" }
    ]
  },
  USA: {
    name: "United States",
    logo: "🇺🇸",
    roster: [
      { name: "Steven Taylor", role: "Batsman", ovr: 74, bat: 75, bowl: 50, batting_hand: "left", batting_archetype: "Opener", bowler_type: "off_spin" },
      { name: "Monank Patel", role: "Wicketkeeper", ovr: 76, bat: 77, bowl: 0, batting_hand: "right", batting_archetype: "Opener" },
      { name: "Andries Gous", role: "Batsman", ovr: 78, bat: 80, bowl: 0, batting_hand: "right", batting_archetype: "Anchor" },
      { name: "Aaron Jones", role: "Batsman", ovr: 77, bat: 79, bowl: 20, batting_hand: "right", batting_archetype: "Brute" },
      { name: "Corey Anderson", role: "All-Rounder", ovr: 78, bat: 76, bowl: 77, batting_hand: "left", batting_archetype: "Finisher", bowler_type: "fast" },
      { name: "Harmeet Singh", role: "All-Rounder", ovr: 75, bat: 70, bowl: 76, batting_hand: "left", batting_archetype: "Finisher", bowler_type: "left_arm_orthodox" },
      { name: "Milind Kumar", role: "Batsman", ovr: 71, bat: 72, bowl: 30, batting_hand: "right", batting_archetype: "Finisher" },
      { name: "Nisarg Patel", role: "Bowler", ovr: 72, bat: 40, bowl: 73, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "left_arm_orthodox" },
      { name: "Saurabh Netravalkar", role: "Bowler", ovr: 79, bat: 25, bowl: 81, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" },
      { name: "Nosthush Kenjige", role: "Bowler", ovr: 74, bat: 10, bowl: 75, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "left_arm_orthodox" },
      { name: "Ali Khan", role: "Bowler", ovr: 77, bat: 5, bowl: 78, batting_hand: "right", batting_archetype: "Tailender", bowler_type: "fast" }
    ]
  }
};

const output = {
  IPL: {
    "2026": iplTeams
  },
  T20_WC: {
    "2026": wcTeams
  }
};

fs.writeFileSync(
  path.join(__dirname, '..', 'data', 'squads.json'),
  JSON.stringify(output, null, 2),
  'utf-8'
);

console.log("Successfully generated squads.json with 20 teams!");
