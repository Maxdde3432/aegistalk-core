CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type VARCHAR(16) NOT NULL CHECK (media_type IN ('image', 'video')),
  caption TEXT,
  accent_key VARCHAR(32) NOT NULL DEFAULT 'aurora',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stories_user_created_at
  ON stories(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stories_active
  ON stories(expires_at)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_story_views_viewer
  ON story_views(viewer_id, viewed_at DESC);
