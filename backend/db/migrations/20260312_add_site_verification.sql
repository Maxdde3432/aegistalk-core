-- Add site verification fields for external links
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS site_verification_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS verification_code TEXT;
