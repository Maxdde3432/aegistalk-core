-- 2026-03-14: Normalize media paths to protected controller format
-- Converts legacy `/uploads/...` URLs (including absolute URLs containing `/uploads/`)
-- to the new protected `/api/media/...` paths in messages.media_url, messages.media_thumbnail_url
-- and inside JSON stored in messages.content_encrypted (base64).

BEGIN;

-- Preview counts before update (optional; comment out if noisy)
-- SELECT
--   COUNT(*) FILTER (WHERE media_url LIKE '%/uploads/%')          AS media_url_legacy,
--   COUNT(*) FILTER (WHERE media_thumbnail_url LIKE '%/uploads/%') AS thumb_legacy,
--   COUNT(*) FILTER (WHERE convert_from(decode(content_encrypted,'base64'),'UTF8') LIKE '%/uploads/%') AS content_legacy
-- FROM messages;

WITH decoded AS (
  SELECT
    id,
    media_url,
    media_thumbnail_url,
    convert_from(decode(content_encrypted, 'base64'), 'UTF8') AS content_text
  FROM messages
  WHERE
    media_url LIKE '%/uploads/%'
    OR media_thumbnail_url LIKE '%/uploads/%'
    OR convert_from(decode(content_encrypted, 'base64'), 'UTF8') LIKE '%/uploads/%'
)
UPDATE messages AS m
SET
  media_url = CASE
    WHEN d.media_url LIKE '%/uploads/%'
      THEN regexp_replace(d.media_url, '/uploads/', '/api/media/', 'g')
    ELSE m.media_url END,
  media_thumbnail_url = CASE
    WHEN d.media_thumbnail_url LIKE '%/uploads/%'
      THEN regexp_replace(d.media_thumbnail_url, '/uploads/', '/api/media/', 'g')
    ELSE m.media_thumbnail_url END,
  content_encrypted = CASE
    WHEN d.content_text LIKE '%/uploads/%'
      THEN encode(
             convert_to(
               regexp_replace(d.content_text, '/uploads/', '/api/media/', 'g'),
               'UTF8'
             ),
             'base64'
           )
    ELSE m.content_encrypted END
FROM decoded d
WHERE m.id = d.id;

-- Preview counts after update (optional)
-- SELECT
--   COUNT(*) FILTER (WHERE media_url LIKE '%/uploads/%')          AS media_url_remaining,
--   COUNT(*) FILTER (WHERE media_thumbnail_url LIKE '%/uploads/%') AS thumb_remaining,
--   COUNT(*) FILTER (WHERE convert_from(decode(content_encrypted,'base64'),'UTF8') LIKE '%/uploads/%') AS content_remaining
-- FROM messages;

COMMIT;

