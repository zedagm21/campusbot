ALTER TABLE users
ADD COLUMN google_id VARCHAR(255) UNIQUE,
ADD COLUMN is_google_user BOOLEAN DEFAULT FALSE;

UPDATE users
SET is_google_user = FALSE
WHERE is_google_user IS NULL;