ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS allow_reactions BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS story_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (story_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_story_likes_story_id
  ON story_likes(story_id, created_at DESC);

CREATE TABLE IF NOT EXISTS story_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_story_comments_story_id
  ON story_comments(story_id, created_at ASC)
  WHERE deleted_at IS NULL;
