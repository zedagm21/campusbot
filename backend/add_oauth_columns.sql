-- Migration: Add Google OAuth columns to users table
-- Run this with: psql -U postgres -d campusbot -f add_oauth_columns.sql

-- Add new columns for OAuth support
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email',
ADD COLUMN IF NOT EXISTS google_id TEXT;

-- Update existing users to be verified (they used email verification)
UPDATE users 
SET is_verified = true 
WHERE auth_provider = 'email' AND is_verified IS NULL;

-- Show the updated table structure
\d users;

-- Verify the changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;
