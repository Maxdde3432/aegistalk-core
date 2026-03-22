import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';

const STORY_MEDIA_TYPES = new Set(['image', 'video']);
const STORY_ACCENTS = new Set(['aurora', 'ember', 'tide', 'nova', 'dusk']);

const normalizeStoryMediaUrl = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (/^[a-z0-9_-]+\/.+/i.test(trimmed) && !trimmed.startsWith('http')) {
    if (trimmed.startsWith('messages/')) {
      return `/uploads/${trimmed}`;
    }
    if (trimmed.startsWith('uploads/')) {
      return `/${trimmed}`;
    }
    if (trimmed.startsWith('api/media/')) {
      return `/${trimmed}`;
    }
  }

  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/api/media/')) {
    return trimmed.split('?')[0];
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith('/uploads/') || parsed.pathname.startsWith('/api/media/')) {
      return parsed.pathname;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
};

const toEpochMs = (value) => {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
};

const buildStoryPayload = (row, currentUserId) => ({
  id: row.id,
  mediaUrl: normalizeStoryMediaUrl(row.media_url),
  mediaType: row.media_type,
  caption: row.caption || '',
  accentKey: row.accent_key || 'aurora',
  createdAt: row.created_at_ms ?? toEpochMs(row.created_at),
  expiresAt: row.expires_at_ms ?? toEpochMs(row.expires_at),
  isOwn: Boolean(row.can_manage_story ?? (row.user_id === currentUserId)),
  isViewed: Boolean(row.is_viewed),
  allowComments: row.allow_comments !== false,
  allowReactions: row.allow_reactions !== false,
  likesCount: Number(row.likes_count || 0),
  commentsCount: Number(row.comments_count || 0),
  viewsCount: Number(row.views_count || 0),
  isLiked: Boolean(row.is_liked),
  sourceType: row.group_id ? 'channel' : 'user',
  groupId: row.group_id || null,
  author: {
    id: row.group_id || row.user_id,
    username: row.group_id ? '' : (row.username || ''),
    firstName: row.group_id ? (row.group_name || '') : (row.first_name || ''),
    lastName: row.group_id ? '' : (row.last_name || ''),
    avatarUrl: row.group_id ? (row.group_avatar_url || '') : (row.avatar_url || ''),
    isChannel: Boolean(row.group_id)
  }
});

const fetchStoryAccess = async (storyId, userId, { includeExpired = false, includeDeleted = false } = {}) => {
  const filters = [];
  if (!includeDeleted) {
    filters.push('s.deleted_at IS NULL');
  }
  if (!includeExpired) {
    filters.push('s.expires_at > NOW()');
  }

  const whereClause = filters.length > 0 ? ` AND ${filters.join(' AND ')}` : '';
  const result = await query(
    `SELECT s.id,
            s.user_id,
            s.group_id,
            s.allow_comments,
            s.allow_reactions,
            g.type AS group_type,
            g.owner_id AS group_owner_id,
            EXISTS(
              SELECT 1
              FROM group_members gm
              WHERE gm.group_id = s.group_id
                AND gm.user_id = $2
                AND gm.is_active = TRUE
            ) AS is_group_member,
            EXISTS(
              SELECT 1
              FROM group_members gm
              WHERE gm.group_id = s.group_id
                AND gm.user_id = $2
                AND gm.is_active = TRUE
                AND gm.role IN ('owner', 'admin')
            ) AS is_group_manager
     FROM stories s
     LEFT JOIN groups g ON g.id = s.group_id
     WHERE s.id = $1${whereClause}
     LIMIT 1`,
    [storyId, userId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const story = result.rows[0];
  const isChannelStory = Boolean(story.group_id);
  const canView = isChannelStory
    ? story.group_owner_id === userId || story.is_group_member === true
    : true;
  const canManage = isChannelStory
    ? story.group_owner_id === userId || story.is_group_manager === true
    : story.user_id === userId;

  return {
    story,
    isChannelStory,
    canView,
    canManage
  };
};

export const listStories = async (req, res) => {
  try {
    const userId = req.userId;
    const storiesResult = await query(
      `SELECT s.id,
              s.user_id,
              s.group_id,
              s.media_url,
              s.media_type,
              s.caption,
              s.accent_key,
              s.allow_comments,
              s.allow_reactions,
              s.created_at,
              s.expires_at,
              ROUND(EXTRACT(EPOCH FROM s.created_at::timestamptz) * 1000)::bigint AS created_at_ms,
              ROUND(EXTRACT(EPOCH FROM s.expires_at::timestamptz) * 1000)::bigint AS expires_at_ms,
              u.username,
              u.first_name,
              u.last_name,
              u.avatar_url,
              g.name AS group_name,
              g.avatar_url AS group_avatar_url,
              (SELECT COUNT(*)::int FROM story_views sv_count WHERE sv_count.story_id = s.id) AS views_count,
              (SELECT COUNT(*)::int FROM story_likes sl WHERE sl.story_id = s.id) AS likes_count,
              (SELECT COUNT(*)::int FROM story_comments sc WHERE sc.story_id = s.id AND sc.deleted_at IS NULL) AS comments_count,
              CASE
                WHEN s.group_id IS NOT NULL THEN (
                  g.owner_id = $1 OR EXISTS(
                    SELECT 1
                    FROM group_members gm_manage
                    WHERE gm_manage.group_id = s.group_id
                      AND gm_manage.user_id = $1
                      AND gm_manage.is_active = TRUE
                      AND gm_manage.role IN ('owner', 'admin')
                  )
                )
                ELSE s.user_id = $1
              END AS can_manage_story,
              EXISTS(
                SELECT 1
                FROM story_likes sl_me
                WHERE sl_me.story_id = s.id
                  AND sl_me.user_id = $1
              ) AS is_liked,
              EXISTS(
                SELECT 1
                FROM story_views sv
                WHERE sv.story_id = s.id
                  AND sv.viewer_id = $1
              ) AS is_viewed
       FROM stories s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN groups g ON g.id = s.group_id
       WHERE s.deleted_at IS NULL
         AND s.expires_at > NOW()
         AND (
           s.group_id IS NULL
           OR (
             g.type = 'channel'
             AND (
               g.owner_id = $1
               OR EXISTS(
                 SELECT 1
                 FROM group_members gm_view
                 WHERE gm_view.group_id = s.group_id
                   AND gm_view.user_id = $1
                   AND gm_view.is_active = TRUE
               )
             )
           )
         )
       ORDER BY CASE
                  WHEN s.group_id IS NULL AND s.user_id = $1 THEN 0
                  WHEN s.group_id IS NOT NULL AND (
                    g.owner_id = $1 OR EXISTS(
                      SELECT 1
                      FROM group_members gm_sort
                      WHERE gm_sort.group_id = s.group_id
                        AND gm_sort.user_id = $1
                        AND gm_sort.is_active = TRUE
                        AND gm_sort.role IN ('owner', 'admin')
                    )
                  ) THEN 1
                  ELSE 2
                END,
                s.created_at DESC`,
      [userId]
    );

    const grouped = [];
    const groupMap = new Map();

    for (const row of storiesResult.rows) {
      const payload = buildStoryPayload(row, userId);
      const entityKey = row.group_id ? `group:${row.group_id}` : `user:${row.user_id}`;
      const existingGroup = groupMap.get(entityKey);

      if (!existingGroup) {
        const group = {
          author: payload.author,
          isOwn: payload.isOwn,
          sourceType: payload.sourceType,
          groupId: payload.groupId,
          hasUnseen: payload.isOwn ? false : !payload.isViewed,
          latestAt: payload.createdAt,
          stories: [payload]
        };
        groupMap.set(entityKey, group);
        grouped.push(group);
        continue;
      }

      existingGroup.stories.push(payload);
      existingGroup.latestAt = Math.max(existingGroup.latestAt || 0, payload.createdAt || 0);
      if (!payload.isOwn && !payload.isViewed) {
        existingGroup.hasUnseen = true;
      }
    }

    res.json(grouped);
  } catch (error) {
    console.error('[Stories] List error:', error);
    res.status(500).json({ error: 'Не удалось загрузить истории' });
  }
};

export const createStory = async (req, res) => {
  try {
    const userId = req.userId;
    const { mediaUrl, mediaType, caption, accentKey, groupId } = req.body;
    const allowComments = typeof req.body?.allowComments === 'boolean' ? req.body.allowComments : true;
    const allowReactions = typeof req.body?.allowReactions === 'boolean' ? req.body.allowReactions : true;
    const normalizedMediaUrl = normalizeStoryMediaUrl(mediaUrl);

    if (!normalizedMediaUrl) {
      return res.status(400).json({ error: 'Нужен файл для истории' });
    }

    if (!STORY_MEDIA_TYPES.has(mediaType)) {
      return res.status(400).json({ error: 'Поддерживаются только image и video истории' });
    }

    const normalizedCaption = typeof caption === 'string' ? caption.trim().slice(0, 280) : '';
    const normalizedAccent = STORY_ACCENTS.has(accentKey) ? accentKey : 'aurora';

    let targetGroupId = null;
    let channelInfo = null;

    if (groupId) {
      const channelResult = await query(
        `SELECT g.id,
                g.name,
                g.avatar_url,
                g.owner_id,
                g.type,
                gm.role AS my_role
         FROM groups g
         LEFT JOIN group_members gm
           ON gm.group_id = g.id
          AND gm.user_id = $2
          AND gm.is_active = TRUE
         WHERE g.id = $1
         LIMIT 1`,
        [groupId, userId]
      );

      if (channelResult.rowCount === 0) {
        return res.status(404).json({ error: 'Канал не найден' });
      }

      channelInfo = channelResult.rows[0];
      if (channelInfo.type !== 'channel') {
        return res.status(400).json({ error: 'Истории канала можно публиковать только в каналах' });
      }

      const canManageChannelStories = channelInfo.owner_id === userId || ['owner', 'admin'].includes(channelInfo.my_role || '');
      if (!canManageChannelStories) {
        return res.status(403).json({ error: 'Публиковать истории канала может только владелец или администратор' });
      }

      targetGroupId = channelInfo.id;
    }

    const activeStories = await query(
      `SELECT COUNT(*)::int AS total
       FROM stories
       WHERE (
         ($2::uuid IS NULL AND user_id = $1 AND group_id IS NULL)
         OR ($2::uuid IS NOT NULL AND group_id = $2)
       )
         AND deleted_at IS NULL
         AND expires_at > NOW()`,
      [userId, targetGroupId]
    );

    if ((activeStories.rows[0]?.total || 0) >= 12) {
      return res.status(400).json({ error: 'Слишком много активных историй. Удалите старые или дождитесь их исчезновения.' });
    }

    const created = await query(
      `INSERT INTO stories (id, user_id, group_id, media_url, media_type, caption, accent_key, created_at, expires_at, allow_comments, allow_reactions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW() + INTERVAL '24 hours', $8, $9)
       RETURNING id,
                 user_id,
                 group_id,
                 media_url,
                 media_type,
                 caption,
                 accent_key,
                 allow_comments,
                 allow_reactions,
                 created_at,
                 expires_at,
                 ROUND(EXTRACT(EPOCH FROM created_at::timestamptz) * 1000)::bigint AS created_at_ms,
                 ROUND(EXTRACT(EPOCH FROM expires_at::timestamptz) * 1000)::bigint AS expires_at_ms`,
      [uuidv4(), userId, targetGroupId, normalizedMediaUrl, mediaType, normalizedCaption, normalizedAccent, allowComments, allowReactions]
    );

    const authorRow = channelInfo
      ? {
          group_name: channelInfo.name,
          group_avatar_url: channelInfo.avatar_url,
          can_manage_story: true
        }
      : (await query(
          `SELECT username, first_name, last_name, avatar_url
           FROM users
           WHERE id = $1`,
          [userId]
        )).rows[0];

    const row = {
      ...created.rows[0],
      ...authorRow,
      views_count: 0,
      likes_count: 0,
      comments_count: 0,
      is_liked: false,
      is_viewed: true,
      can_manage_story: true
    };

    res.status(201).json(buildStoryPayload(row, userId));
  } catch (error) {
    console.error('[Stories] Create error:', error);
    res.status(500).json({ error: 'Не удалось опубликовать историю' });
  }
};

export const markStoryViewed = async (req, res) => {
  try {
    const userId = req.userId;
    const { storyId } = req.params;

    const access = await fetchStoryAccess(storyId, userId);
    if (!access) {
      return res.status(404).json({ error: 'История не найдена' });
    }

    if (!access.canView) {
      return res.status(403).json({ error: 'Эта история доступна только подписчикам канала' });
    }

    if (!access.canManage) {
      await query(
        `INSERT INTO story_views (id, story_id, viewer_id, viewed_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (story_id, viewer_id)
         DO UPDATE SET viewed_at = EXCLUDED.viewed_at`,
        [uuidv4(), storyId, userId]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Stories] View mark error:', error);
    res.status(500).json({ error: 'Не удалось отметить просмотр истории' });
  }
};

export const deleteStory = async (req, res) => {
  try {
    const userId = req.userId;
    const { storyId } = req.params;

    const access = await fetchStoryAccess(storyId, userId, { includeExpired: true });
    if (!access) {
      return res.status(404).json({ error: 'История не найдена или уже удалена' });
    }

    if (!access.canManage) {
      return res.status(403).json({ error: 'Удалять историю может только автор или администратор канала' });
    }

    const result = await query(
      `UPDATE stories
       SET deleted_at = NOW()
       WHERE id = $1
         AND deleted_at IS NULL
       RETURNING id`,
      [storyId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'История не найдена или уже удалена' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Stories] Delete error:', error);
    res.status(500).json({ error: 'Не удалось удалить историю' });
  }
};

export const listStoryComments = async (req, res) => {
  try {
    const userId = req.userId;
    const { storyId } = req.params;

    const access = await fetchStoryAccess(storyId, userId);
    if (!access) {
      return res.status(404).json({ error: 'История не найдена' });
    }

    if (!access.canView) {
      return res.status(403).json({ error: 'Комментарии доступны только подписчикам канала' });
    }

    if (access.story.allow_comments === false && !access.canManage) {
      return res.json([]);
    }

    const commentsResult = await query(
      `SELECT sc.id,
              sc.story_id,
              sc.user_id,
              sc.content,
              sc.created_at,
              ROUND(EXTRACT(EPOCH FROM sc.created_at::timestamptz) * 1000)::bigint AS created_at_ms,
              u.username,
              u.first_name,
              u.last_name,
              u.avatar_url
       FROM story_comments sc
       JOIN users u ON u.id = sc.user_id
       WHERE sc.story_id = $1
         AND sc.deleted_at IS NULL
       ORDER BY sc.created_at ASC
       LIMIT 80`,
      [storyId]
    );

    res.json(commentsResult.rows.map((row) => ({
      id: row.id,
      storyId: row.story_id,
      userId: row.user_id,
      content: row.content,
      createdAt: row.created_at_ms ?? toEpochMs(row.created_at),
      author: {
        id: row.user_id,
        username: row.username || '',
        firstName: row.first_name || '',
        lastName: row.last_name || '',
        avatarUrl: row.avatar_url || ''
      }
    })));
  } catch (error) {
    console.error('[Stories] List comments error:', error);
    res.status(500).json({ error: 'Не удалось загрузить комментарии' });
  }
};

export const addStoryComment = async (req, res) => {
  try {
    const userId = req.userId;
    const { storyId } = req.params;
    const content = String(req.body?.content || '').trim().slice(0, 280);

    if (!content) {
      return res.status(400).json({ error: 'Комментарий не должен быть пустым' });
    }

    const access = await fetchStoryAccess(storyId, userId);
    if (!access) {
      return res.status(404).json({ error: 'История не найдена' });
    }

    if (!access.canView) {
      return res.status(403).json({ error: 'Комментировать историю могут только подписчики канала' });
    }

    if (access.story.allow_comments === false && !access.canManage) {
      return res.status(403).json({ error: 'Комментарии к этой истории отключены' });
    }

    const created = await query(
      `INSERT INTO story_comments (id, story_id, user_id, content, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, story_id, user_id, content, created_at,
                 ROUND(EXTRACT(EPOCH FROM created_at::timestamptz) * 1000)::bigint AS created_at_ms`,
      [uuidv4(), storyId, userId, content]
    );

    const authorResult = await query(
      `SELECT username, first_name, last_name, avatar_url
       FROM users
       WHERE id = $1`,
      [userId]
    );

    const row = {
      ...created.rows[0],
      ...authorResult.rows[0]
    };

    res.status(201).json({
      id: row.id,
      storyId: row.story_id,
      userId: row.user_id,
      content: row.content,
      createdAt: row.created_at_ms ?? toEpochMs(row.created_at),
      author: {
        id: row.user_id,
        username: row.username || '',
        firstName: row.first_name || '',
        lastName: row.last_name || '',
        avatarUrl: row.avatar_url || ''
      }
    });
  } catch (error) {
    console.error('[Stories] Add comment error:', error);
    res.status(500).json({ error: 'Не удалось отправить комментарий' });
  }
};

export const toggleStoryLike = async (req, res) => {
  try {
    const userId = req.userId;
    const { storyId } = req.params;

    const access = await fetchStoryAccess(storyId, userId);
    if (!access) {
      return res.status(404).json({ error: 'История не найдена' });
    }

    if (!access.canView) {
      return res.status(403).json({ error: 'История доступна только подписчикам канала' });
    }

    if (access.story.allow_reactions === false && !access.canManage) {
      return res.status(403).json({ error: 'Лайки к этой истории отключены' });
    }

    const existingLike = await query(
      `SELECT id
       FROM story_likes
       WHERE story_id = $1
         AND user_id = $2`,
      [storyId, userId]
    );

    let isLiked = false;
    if (existingLike.rowCount > 0) {
      await query(
        `DELETE FROM story_likes
         WHERE story_id = $1
           AND user_id = $2`,
        [storyId, userId]
      );
    } else {
      await query(
        `INSERT INTO story_likes (id, story_id, user_id, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [uuidv4(), storyId, userId]
      );
      isLiked = true;
    }

    const counts = await query(
      `SELECT COUNT(*)::int AS likes_count
       FROM story_likes
       WHERE story_id = $1`,
      [storyId]
    );

    res.json({
      success: true,
      isLiked,
      likesCount: Number(counts.rows[0]?.likes_count || 0)
    });
  } catch (error) {
    console.error('[Stories] Toggle like error:', error);
    res.status(500).json({ error: 'Не удалось обновить лайк' });
  }
};

export const updateStorySettings = async (req, res) => {
  try {
    const userId = req.userId;
    const { storyId } = req.params;
    const allowComments = req.body?.allowComments;
    const allowReactions = req.body?.allowReactions;

    const access = await fetchStoryAccess(storyId, userId, { includeExpired: true });
    if (!access) {
      return res.status(404).json({ error: 'История не найдена' });
    }

    if (!access.canManage) {
      return res.status(403).json({ error: 'Настройки истории может менять только автор или администратор канала' });
    }

    const result = await query(
      `UPDATE stories
       SET allow_comments = COALESCE($2, allow_comments),
           allow_reactions = COALESCE($3, allow_reactions)
       WHERE id = $1
         AND deleted_at IS NULL
       RETURNING id, allow_comments, allow_reactions`,
      [
        storyId,
        typeof allowComments === 'boolean' ? allowComments : null,
        typeof allowReactions === 'boolean' ? allowReactions : null
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'История не найдена' });
    }

    res.json({
      success: true,
      allowComments: result.rows[0].allow_comments,
      allowReactions: result.rows[0].allow_reactions
    });
  } catch (error) {
    console.error('[Stories] Update settings error:', error);
    res.status(500).json({ error: 'Не удалось обновить настройки истории' });
  }
};

export const listStoryViews = async (req, res) => {
  try {
    const userId = req.userId;
    const { storyId } = req.params;

    const access = await fetchStoryAccess(storyId, userId, { includeExpired: true });
    if (!access) {
      return res.status(404).json({ error: 'История не найдена' });
    }

    if (!access.canManage) {
      return res.status(403).json({ error: 'Просмотры истории доступны только автору или администратору канала' });
    }

    const viewsResult = await query(
      `SELECT sv.id,
              sv.viewer_id,
              sv.viewed_at,
              ROUND(EXTRACT(EPOCH FROM sv.viewed_at::timestamptz) * 1000)::bigint AS viewed_at_ms,
              u.username,
              u.first_name,
              u.last_name,
              u.avatar_url
       FROM story_views sv
       JOIN users u ON u.id = sv.viewer_id
       WHERE sv.story_id = $1
       ORDER BY sv.viewed_at DESC`,
      [storyId]
    );

    res.json({
      total: viewsResult.rowCount,
      viewers: viewsResult.rows.map((row) => ({
        id: row.id,
        userId: row.viewer_id,
        viewedAt: row.viewed_at_ms ?? toEpochMs(row.viewed_at),
        user: {
          id: row.viewer_id,
          username: row.username || '',
          firstName: row.first_name || '',
          lastName: row.last_name || '',
          avatarUrl: row.avatar_url || ''
        }
      }))
    });
  } catch (error) {
    console.error('[Stories] List views error:', error);
    res.status(500).json({ error: 'Не удалось загрузить просмотры' });
  }
};


export const getChannelStoryStats = async (req, res) => {
  try {
    const userId = req.userId;
    const { groupId } = req.params;

    const accessResult = await query(
      `SELECT g.id,
              g.owner_id,
              g.type,
              gm.role AS my_role
       FROM groups g
       LEFT JOIN group_members gm
         ON gm.group_id = g.id
        AND gm.user_id = $2
        AND gm.is_active = TRUE
       WHERE g.id = $1
       LIMIT 1`,
      [groupId, userId]
    );

    if (accessResult.rowCount === 0) {
      return res.status(404).json({ error: 'Канал не найден' });
    }

    const channel = accessResult.rows[0];
    if (channel.type !== 'channel') {
      return res.status(400).json({ error: 'Статистика историй доступна только для каналов' });
    }

    const canManage = channel.owner_id === userId || ['owner', 'admin'].includes(channel.my_role || '');
    if (!canManage) {
      return res.status(403).json({ error: 'Статистика историй канала доступна только владельцу или администратору' });
    }

    const statsResult = await query(
      `SELECT COUNT(*)::int AS active_stories,
              COALESCE(SUM(view_stats.views_count), 0)::int AS total_views,
              COALESCE(SUM(like_stats.likes_count), 0)::int AS total_likes,
              COALESCE(SUM(comment_stats.comments_count), 0)::int AS total_comments,
              MAX(ROUND(EXTRACT(EPOCH FROM s.created_at::timestamptz) * 1000)::bigint) AS last_story_at
       FROM stories s
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS views_count
         FROM story_views sv
         WHERE sv.story_id = s.id
       ) view_stats ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS likes_count
         FROM story_likes sl
         WHERE sl.story_id = s.id
       ) like_stats ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS comments_count
         FROM story_comments sc
         WHERE sc.story_id = s.id
           AND sc.deleted_at IS NULL
       ) comment_stats ON TRUE
       WHERE s.group_id = $1
         AND s.deleted_at IS NULL
         AND s.expires_at > NOW()`,
      [groupId]
    );

    const stats = statsResult.rows[0] || {};
    res.json({
      activeStories: Number(stats.active_stories || 0),
      totalViews: Number(stats.total_views || 0),
      totalLikes: Number(stats.total_likes || 0),
      totalComments: Number(stats.total_comments || 0),
      lastStoryAt: stats.last_story_at ? Number(stats.last_story_at) : null
    });
  } catch (error) {
    console.error('[Stories] Channel stats error:', error);
    res.status(500).json({ error: 'Не удалось загрузить статистику историй канала' });
  }
};
