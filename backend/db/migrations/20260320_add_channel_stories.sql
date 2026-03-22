ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_stories_group_created_at
  ON stories(group_id, created_at DESC)
  WHERE group_id IS NOT NULL;
