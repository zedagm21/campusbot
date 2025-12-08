-- Add new columns for OAuth support and verification.
-- IF NOT EXISTS clauses are added to make the script idempotent and runnable multiple times without error.
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email',
ADD COLUMN IF NOT EXISTS google_id TEXT;

-- Update existing users (who signed up before this migration) to be marked as verified.
UPDATE users 
SET is_verified = true 
WHERE auth_provider = 'email' AND is_verified IS NULL;