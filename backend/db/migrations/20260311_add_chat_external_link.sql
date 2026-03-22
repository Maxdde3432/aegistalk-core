-- Add external_link to chats so channels can expose a site link in headers
ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS external_link TEXT;
