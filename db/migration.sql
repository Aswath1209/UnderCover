-- Run this snippet in your Supabase Dashboard SQL Editor
-- This will add the coins column to the profiles table
-- and backward-compatibly assign the 2000 coin Welcome Bonus to everyone who already exists.

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS coins INT DEFAULT 2000;

-- In case there are already rows that somehow missed the default
UPDATE profiles 
SET coins = 2000 
WHERE coins IS NULL;
