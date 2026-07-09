const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const rawPlayers = [
  // --- CHENNAI SUPER KINGS (CSK) ---
  {
    name: "Gurjapneet Singh",
    country: "India",
    role: "bowler",
    batting_rating: 11,
    bowling_rating: 76,
    ovr: 76,
    bowler_type: "left-arm fast-medium",
    buy_price: 3250,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Kuldip Yadav",
    country: "India",
    role: "bowler",
    batting_rating: 10,
    bowling_rating: 75,
    ovr: 75,
    bowler_type: "left-arm fast-medium",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Prashant Veer",
    country: "India",
    role: "all-rounder",
    batting_rating: 68,
    bowling_rating: 74,
    ovr: 75,
    bowler_type: "slow left-arm orthodox",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: "Tactician",
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Dian Forrester",
    country: "South Africa",
    role: "all-rounder",
    batting_rating: 74,
    bowling_rating: 73,
    ovr: 76,
    bowler_type: "right-arm fast-medium",
    buy_price: 3250,
    tier: "Normal",
    batting_archetype: "Power",
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Aman Hakim Khan",
    country: "India",
    role: "all-rounder",
    batting_rating: 76,
    bowling_rating: 70,
    ovr: 77,
    bowler_type: "right-arm fast-medium",
    buy_price: 6755,
    tier: "Normal",
    batting_archetype: "Power",
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Macneil Noronha",
    country: "India",
    role: "all-rounder",
    batting_rating: 70,
    bowling_rating: 74,
    ovr: 75,
    bowler_type: "right-arm offbreak",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: "Tactician",
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Zak Foulkes",
    country: "New Zealand",
    role: "all-rounder",
    batting_rating: 68,
    bowling_rating: 79,
    ovr: 79,
    bowler_type: "right-arm fast-medium",
    buy_price: 14600,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Urvil Patel",
    country: "India",
    role: "wicket-keeper",
    batting_rating: 75,
    bowling_rating: 10,
    ovr: 75,
    bowler_type: null,
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: "Power",
    bowling_archetype: null,
    image_url: null
  },
  {
    name: "Anshul Kamboj",
    country: "India",
    role: "bowler",
    batting_rating: 14,
    bowling_rating: 80,
    ovr: 80,
    bowler_type: "right-arm fast-medium",
    buy_price: 31445,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Ramakrishna Ghosh",
    country: "India",
    role: "all-rounder",
    batting_rating: 68,
    bowling_rating: 74,
    ovr: 75,
    bowler_type: "right-arm fast-medium",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: "Pacer",
    image_url: null
  },

  // --- ROYAL CHALLENGERS BENGALURU (RCB) ---
  {
    name: "Suyash Sharma",
    country: "India",
    role: "bowler",
    batting_rating: 12,
    bowling_rating: 80,
    ovr: 80,
    bowler_type: "right-arm legbreak",
    buy_price: 31445,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Abhinandan Singh",
    country: "India",
    role: "bowler",
    batting_rating: 11,
    bowling_rating: 75,
    ovr: 75,
    bowler_type: "right-arm fast-medium",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Kanishk Chouhan",
    country: "India",
    role: "all-rounder",
    batting_rating: 67,
    bowling_rating: 74,
    ovr: 75,
    bowler_type: "right-arm offbreak",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Satvik Deswal",
    country: "India",
    role: "all-rounder",
    batting_rating: 66,
    bowling_rating: 74,
    ovr: 75,
    bowler_type: "slow left-arm orthodox",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: "Tactician",
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Vihaan Malhotra",
    country: "India",
    role: "batsman",
    batting_rating: 76,
    bowling_rating: 10,
    ovr: 76,
    bowler_type: null,
    buy_price: 3250,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: null,
    image_url: null
  },
  {
    name: "Mangesh Yadav",
    country: "India",
    role: "bowler",
    batting_rating: 10,
    bowling_rating: 75,
    ovr: 75,
    bowler_type: "left-arm fast",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Nuwan Thushara",
    country: "Sri Lanka",
    role: "bowler",
    batting_rating: 12,
    bowling_rating: 83,
    ovr: 83,
    bowler_type: "right-arm fast-medium",
    buy_price: 137650,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },

  // --- MUMBAI INDIANS (MI) ---
  {
    name: "Mayank Rawat",
    country: "India",
    role: "all-rounder",
    batting_rating: 68,
    bowling_rating: 74,
    ovr: 75,
    bowler_type: "right-arm offbreak",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Danish Malewar",
    country: "India",
    role: "batsman",
    batting_rating: 76,
    bowling_rating: 12,
    ovr: 76,
    bowler_type: "right-arm legbreak",
    buy_price: 3250,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Robin Minz",
    country: "India",
    role: "wicket-keeper",
    batting_rating: 78,
    bowling_rating: 10,
    ovr: 78,
    bowler_type: null,
    buy_price: 10250,
    tier: "Normal",
    batting_archetype: "Power",
    bowling_archetype: null,
    image_url: null
  },
  {
    name: "Mohammad Izhar",
    country: "India",
    role: "bowler",
    batting_rating: 10,
    bowling_rating: 75,
    ovr: 75,
    bowler_type: "left-arm medium-fast",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Krish Bhagat",
    country: "India",
    role: "all-rounder",
    batting_rating: 68,
    bowling_rating: 74,
    ovr: 75,
    bowler_type: "right-arm medium-fast",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Raghu Sharma",
    country: "India",
    role: "bowler",
    batting_rating: 13,
    bowling_rating: 76,
    ovr: 76,
    bowler_type: "right-arm legbreak",
    buy_price: 3250,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Ruchit Ahir",
    country: "India",
    role: "wicket-keeper",
    batting_rating: 75,
    bowling_rating: 10,
    ovr: 75,
    bowler_type: null,
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: "Tactician",
    bowling_archetype: null,
    image_url: null
  },
  {
    name: "Raj Angad Bawa",
    country: "India",
    role: "all-rounder",
    batting_rating: 72,
    bowling_rating: 76,
    ovr: 77,
    bowler_type: "right-arm medium-fast",
    buy_price: 6755,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Atharva Ankolekar",
    country: "India",
    role: "all-rounder",
    batting_rating: 71,
    bowling_rating: 75,
    ovr: 76,
    bowler_type: "slow left-arm orthodox",
    buy_price: 3250,
    tier: "Normal",
    batting_archetype: "Tactician",
    bowling_archetype: "Spinner",
    image_url: null
  },

  // --- KOLKATA KNIGHT RIDERS (KKR) ---
  {
    name: "Tejasvi Singh Dahiya",
    country: "India",
    role: "batsman",
    batting_rating: 75,
    bowling_rating: 10,
    ovr: 75,
    bowler_type: null,
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: null,
    image_url: null
  },
  {
    name: "Ramandeep Singh",
    country: "India",
    role: "all-rounder",
    batting_rating: 79,
    bowling_rating: 75,
    ovr: 80,
    bowler_type: "right-arm medium",
    buy_price: 31445,
    tier: "Normal",
    batting_archetype: "Finisher",
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Sarthak Ranjan",
    country: "India",
    role: "batsman",
    batting_rating: 76,
    bowling_rating: 12,
    ovr: 76,
    bowler_type: "right-arm legbreak",
    buy_price: 3250,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Daksh Kamra",
    country: "India",
    role: "batsman",
    batting_rating: 75,
    bowling_rating: 10,
    ovr: 75,
    bowler_type: "right-arm legbreak",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Vaibhav Arora",
    country: "India",
    role: "bowler",
    batting_rating: 15,
    bowling_rating: 80,
    ovr: 80,
    bowler_type: "right-arm fast-medium",
    buy_price: 31445,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Saurabh Dubey",
    country: "India",
    role: "bowler",
    batting_rating: 11,
    bowling_rating: 75,
    ovr: 75,
    bowler_type: "left-arm fast-medium",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Prashant Solanki",
    country: "India",
    role: "bowler",
    batting_rating: 11,
    bowling_rating: 77,
    ovr: 77,
    bowler_type: "right-arm legbreak",
    buy_price: 6755,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Spinner",
    image_url: null
  },

  // --- SUNRISERS HYDERABAD (SRH) ---
  {
    name: "Aniket Verma",
    country: "India",
    role: "all-rounder",
    batting_rating: 67,
    bowling_rating: 74,
    ovr: 75,
    bowler_type: "right-arm medium-fast",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Smaran Ravichandran",
    country: "India",
    role: "batsman",
    batting_rating: 76,
    bowling_rating: 10,
    ovr: 76,
    bowler_type: "right-arm offbreak",
    buy_price: 3250,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Heinrich Klaasen",
    country: "South Africa",
    role: "wicket-keeper",
    batting_rating: 91,
    bowling_rating: 10,
    ovr: 91,
    bowler_type: null,
    buy_price: 1200000,
    tier: "Normal",
    batting_archetype: "Power",
    bowling_archetype: null,
    image_url: null
  },
  {
    name: "Shivang Kumar",
    country: "India",
    role: "all-rounder",
    batting_rating: 67,
    bowling_rating: 74,
    ovr: 75,
    bowler_type: "left-arm unorthodox",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: "Tactician",
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Eshan Malinga",
    country: "India",
    role: "bowler",
    batting_rating: 10,
    bowling_rating: 81,
    ovr: 81,
    bowler_type: "right-arm fast",
    buy_price: 56420,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Praful Hinge",
    country: "India",
    role: "bowler",
    batting_rating: 12,
    bowling_rating: 75,
    ovr: 75,
    bowler_type: "left-arm orthodox",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Onkar Tarmale",
    country: "India",
    role: "bowler",
    batting_rating: 11,
    bowling_rating: 75,
    ovr: 75,
    bowler_type: "right-arm fast",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Sakib Hussain",
    country: "India",
    role: "bowler",
    batting_rating: 12,
    bowling_rating: 76,
    ovr: 76,
    bowler_type: "right-arm fast-medium",
    buy_price: 3250,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Zeeshan Ansari",
    country: "India",
    role: "bowler",
    batting_rating: 13,
    bowling_rating: 77,
    ovr: 77,
    bowler_type: "right-arm legbreak",
    buy_price: 6755,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Amit Kumar",
    country: "India",
    role: "all-rounder",
    batting_rating: 67,
    bowling_rating: 74,
    ovr: 75,
    bowler_type: "right-arm medium",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Krains Fuletra",
    country: "India",
    role: "all-rounder",
    batting_rating: 68,
    bowling_rating: 74,
    ovr: 75,
    bowler_type: "right-arm offbreak",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: "Spinner",
    image_url: null
  },

  // --- DELHI CAPITALS (DC) ---
  {
    name: "Vipraj Nigam",
    country: "India",
    role: "bowler",
    batting_rating: 12,
    bowling_rating: 75,
    ovr: 75,
    bowler_type: "right-arm legbreak",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Tripurana Vijay",
    country: "India",
    role: "bowler",
    batting_rating: 13,
    bowling_rating: 76,
    ovr: 76,
    bowler_type: "right-arm offbreak",
    buy_price: 3250,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Madhav Tiwari",
    country: "India",
    role: "bowler",
    batting_rating: 12,
    bowling_rating: 76,
    ovr: 76,
    bowler_type: "right-arm medium-fast",
    buy_price: 3250,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Auqib Nabi",
    country: "India",
    role: "all-rounder",
    batting_rating: 71,
    bowling_rating: 76,
    ovr: 77,
    bowler_type: "right-arm medium-fast",
    buy_price: 6755,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Sahil Ulhas Parakh",
    country: "India",
    role: "batsman",
    batting_rating: 76,
    bowling_rating: 10,
    ovr: 76,
    bowler_type: null,
    buy_price: 3250,
    tier: "Normal",
    batting_archetype: "Power",
    bowling_archetype: null,
    image_url: null
  },

  // --- GUJARAT TITANS (GT) ---
  {
    name: "Kumar Kushagra",
    country: "India",
    role: "wicket-keeper",
    batting_rating: 78,
    bowling_rating: 10,
    ovr: 78,
    bowler_type: null,
    buy_price: 10250,
    tier: "Normal",
    batting_archetype: "Power",
    bowling_archetype: null,
    image_url: null
  },
  {
    name: "Arshad Khan",
    country: "India",
    role: "all-rounder",
    batting_rating: 73,
    bowling_rating: 78,
    ovr: 78,
    bowler_type: "left-arm medium-fast",
    buy_price: 10250,
    tier: "Normal",
    batting_archetype: "Power",
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Nishant Sindhu",
    country: "India",
    role: "all-rounder",
    batting_rating: 77,
    bowling_rating: 72,
    ovr: 77,
    bowler_type: "slow left-arm orthodox",
    buy_price: 6755,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Gurnoor Singh Brar",
    country: "India",
    role: "bowler",
    batting_rating: 14,
    bowling_rating: 76,
    ovr: 76,
    bowler_type: "right-arm fast-medium",
    buy_price: 3250,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Manav Suthar",
    country: "India",
    role: "all-rounder",
    batting_rating: 70,
    bowling_rating: 79,
    ovr: 79,
    bowler_type: "slow left-arm orthodox",
    buy_price: 14600,
    tier: "Normal",
    batting_archetype: "Tactician",
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Ashok Sharma",
    country: "India",
    role: "bowler",
    batting_rating: 11,
    bowling_rating: 75,
    ovr: 75,
    bowler_type: "right-arm medium-fast",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Prithvi Raj Yarra",
    country: "India",
    role: "bowler",
    batting_rating: 11,
    bowling_rating: 76,
    ovr: 76,
    bowler_type: "left-arm fast-medium",
    buy_price: 3250,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },

  // --- LUCKNOW SUPER GIANTS (LSG) ---
  {
    name: "Ayush Badoni",
    country: "India",
    role: "batsman",
    batting_rating: 81,
    bowling_rating: 58,
    ovr: 81,
    bowler_type: "right-arm offbreak",
    buy_price: 56420,
    tier: "Normal",
    batting_archetype: "Finisher",
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Arjun Tendulkar",
    country: "India",
    role: "all-rounder",
    batting_rating: 68,
    bowling_rating: 74,
    ovr: 75,
    bowler_type: "left-arm fast-medium",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Mukul Choudhary",
    country: "India",
    role: "wicket-keeper",
    batting_rating: 75,
    bowling_rating: 10,
    ovr: 75,
    bowler_type: null,
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: null,
    image_url: null
  },
  {
    name: "Akshat Raghuwanshi",
    country: "India",
    role: "batsman",
    batting_rating: 76,
    bowling_rating: 10,
    ovr: 76,
    bowler_type: null,
    buy_price: 3250,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: null,
    image_url: null
  },
  {
    name: "Himmat Singh",
    country: "India",
    role: "batsman",
    batting_rating: 74,
    bowling_rating: 10,
    ovr: 74,
    bowler_type: null,
    buy_price: 1000,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: null,
    image_url: null
  },
  {
    name: "Arshin Kulkarni",
    country: "India",
    role: "all-rounder",
    batting_rating: 78,
    bowling_rating: 72,
    ovr: 78,
    bowler_type: "right-arm medium",
    buy_price: 10250,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Akash Singh",
    country: "India",
    role: "bowler",
    batting_rating: 11,
    bowling_rating: 76,
    ovr: 76,
    bowler_type: "left-arm fast-medium",
    buy_price: 3250,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Digvesh Singh",
    country: "India",
    role: "bowler",
    batting_rating: 10,
    bowling_rating: 75,
    ovr: 75,
    bowler_type: "right-arm medium",
    buy_price: 1100,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Prince Yadav",
    country: "India",
    role: "bowler",
    batting_rating: 12,
    bowling_rating: 81,
    ovr: 81,
    bowler_type: "right-arm fast-medium",
    buy_price: 56420,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },

  // --- PUNJAB KINGS (PBKS) ---
  {
    name: "Cooper Connolly",
    country: "Australia",
    role: "all-rounder",
    batting_rating: 82,
    bowling_rating: 77,
    ovr: 82,
    bowler_type: "slow left-arm orthodox",
    buy_price: 84750,
    tier: "Normal",
    batting_archetype: "Tactician",
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Ben Dwarshuis",
    country: "Australia",
    role: "bowler",
    batting_rating: 25,
    bowling_rating: 81,
    ovr: 81,
    bowler_type: "left-arm fast-medium",
    buy_price: 56420,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Yash Thakur",
    country: "India",
    role: "bowler",
    batting_rating: 14,
    bowling_rating: 81,
    ovr: 81,
    bowler_type: "right-arm fast-medium",
    buy_price: 56420,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Bevon Jacobs",
    country: "India",
    role: "batsman",
    batting_rating: 76,
    bowling_rating: 10,
    ovr: 76,
    bowler_type: null,
    buy_price: 3250,
    tier: "Normal",
    batting_archetype: "Power",
    bowling_archetype: null,
    image_url: null
  },

  // --- RAJASTHAN ROYALS (RR) ---
  {
    name: "Shubham Dubey",
    country: "India",
    role: "batsman",
    batting_rating: 78,
    bowling_rating: 10,
    ovr: 78,
    bowler_type: "right-arm offbreak",
    buy_price: 10250,
    tier: "Normal",
    batting_archetype: "Finisher",
    bowling_archetype: "Spinner",
    image_url: null
  },
  {
    name: "Vaibhav Suryavanshi",
    country: "India",
    role: "batsman",
    batting_rating: 84,
    bowling_rating: 10,
    ovr: 84,
    bowler_type: null,
    buy_price: 214750,
    tier: "Normal",
    batting_archetype: "Classic",
    bowling_archetype: null,
    image_url: null
  },
  {
    name: "Yudhvir Singh Charak",
    country: "India",
    role: "all-rounder",
    batting_rating: 70,
    bowling_rating: 75,
    ovr: 76,
    bowler_type: "right-arm medium-fast",
    buy_price: 3250,
    tier: "Normal",
    batting_archetype: "Power",
    bowling_archetype: "Pacer",
    image_url: null
  },
  {
    name: "Kuldeep Sen",
    country: "India",
    role: "bowler",
    batting_rating: 13,
    bowling_rating: 81,
    ovr: 81,
    bowler_type: "right-arm fast",
    buy_price: 56420,
    tier: "Normal",
    batting_archetype: null,
    bowling_archetype: "Pacer",
    image_url: null
  }
];

// Helper to raise any secondary rating below 27 to the 27-40 range
function boostSecondary(val) {
  if (val < 27) {
    // Map values of 10-25 into a realistic secondary range of 27-40
    return 27 + (val % 14);
  }
  return val;
}

const playersToProcess = rawPlayers.map(p => {
  const updated = { ...p };
  if (p.role === 'bowler') {
    updated.batting_rating = boostSecondary(p.batting_rating);
  } else if (p.role === 'batsman' || p.role === 'wicket-keeper') {
    updated.bowling_rating = boostSecondary(p.bowling_rating);
  }
  return updated;
});

async function processPlayers() {
  console.log("Fetching all current players from Supabase...");
  let allPlayers = [];
  let from = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('cricketplayers')
      .select('*')
      .range(from, from + limit - 1);
    if (error) {
      console.error("Error fetching players:", error);
      return;
    }
    if (!data || data.length === 0) break;
    allPlayers.push(...data);
    if (data.length < limit) break;
    from += limit;
  }

  const dbMap = {};
  allPlayers.forEach(p => {
    const norm = p.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    dbMap[norm] = p;
  });

  console.log(`Processing ${playersToProcess.length} players...`);
  
  const toInsert = [];
  const toUpdate = [];

  for (const p of playersToProcess) {
    const norm = p.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (dbMap[norm]) {
      const existing = dbMap[norm];
      toUpdate.push({
        id: existing.id,
        name: existing.name,
        country: p.country,
        role: p.role,
        batting_rating: p.batting_rating,
        bowling_rating: p.bowling_rating,
        ovr: p.ovr,
        bowler_type: p.bowler_type,
        buy_price: p.buy_price,
        tier: p.tier,
        batting_archetype: p.batting_archetype,
        bowling_archetype: p.bowling_archetype,
        image_url: existing.image_url || p.image_url
      });
    } else {
      toInsert.push({
        id: crypto.randomUUID(),
        ...p,
        created_at: new Date().toISOString()
      });
    }
  }

  if (toInsert.length > 0) {
    console.log(`Inserting ${toInsert.length} new players...`);
    const { data, error } = await supabase.from('cricketplayers').insert(toInsert).select();
    if (error) {
      console.error("Error during insertion:", error);
    } else {
      console.log(`Successfully inserted ${data.length} new players!`);
    }
  }

  if (toUpdate.length > 0) {
    console.log(`Updating ${toUpdate.length} existing players...`);
    for (const updateItem of toUpdate) {
      const { error } = await supabase
        .from('cricketplayers')
        .update({
          country: updateItem.country,
          role: updateItem.role,
          batting_rating: updateItem.batting_rating,
          bowling_rating: updateItem.bowling_rating,
          ovr: updateItem.ovr,
          bowler_type: updateItem.bowler_type,
          buy_price: updateItem.buy_price,
          tier: updateItem.tier,
          batting_archetype: updateItem.batting_archetype,
          bowling_archetype: updateItem.bowling_archetype,
          image_url: updateItem.image_url
        })
        .eq('id', updateItem.id);
      if (error) {
        console.error(`Error updating player ${updateItem.name}:`, error);
      } else {
        console.log(`Successfully updated ${updateItem.name} (OVR: ${updateItem.ovr}, Bat: ${updateItem.batting_rating}, Bowl: ${updateItem.bowling_rating})`);
      }
    }
  }
}

processPlayers();
