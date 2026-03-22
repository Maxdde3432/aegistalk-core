-- Add external_link to groups for channel/site reference
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS external_link TEXT;
