import { Router } from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth.js';
import { query } from '../db/index.js';

const router = Router();

router.use(authenticate);

// POST /api/groups/:groupId/verify-site
router.post('/groups/:groupId/verify-site', async (req, res) => {
  const { groupId } = req.params;
  const userId = req.userId;

  try {
    // check role
    const roleRes = await query(
      `SELECT g.external_link, g.verification_code, g.site_verification_status, g.owner_id,
              gm.role
         FROM groups g
         LEFT JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $2
        WHERE g.id = $1`,
      [groupId, userId]
    );
    const row = roleRes.rows[0];
    if (!row) return res.status(404).json({ error: 'Группа не найдена' });
    const isOwner = row.owner_id === userId;
    const isAdmin = row.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Недостаточно прав' });

    const url = row.external_link;
    let expected = row.verification_code;
    console.log('[verify-site] groupId:', groupId, 'userId:', userId, 'url:', url || '(empty)', 'code:', expected || '(empty)');
    if (!url) return res.status(400).json({ error: 'Ссылка не задана' });
    if (!expected) {
      return res.status(400).json({ error: 'Verification code is missing. Save the site link again to generate a fresh code.' });
    }
    if (!url.startsWith('https://')) return res.status(400).json({ error: 'Ссылка должна начинаться с https://' });

    let html = '';
    try {
      const resp = await axios.get(url, {
        timeout: 5000,
        maxRedirects: 3,
        validateStatus: () => true,
        headers: {
          'User-Agent': 'AegisTalkVerifier/1.0'
        }
      });
      console.log('[verify-site] fetch status', resp.status);
      if (resp.status >= 400) {
        return res.status(400).json({ error: `Сайт отвечает с кодом ${resp.status}` });
      }
      html = resp.data || '';
    } catch (e) {
      console.error('[verify-site] fetch error', e?.message);
      return res.status(400).json({ error: 'Не удалось открыть сайт' });
    }

    const regex = new RegExp(`<meta\\s+name=["']aegis-site-verification["']\\s+content=["']${expected}["']`, 'i');
    if (!regex.test(html)) {
      return res.status(400).json({ error: 'Код верификации не найден. Проверьте мета-тег.' });
    }

    await query(
      `UPDATE groups
         SET site_verification_status = 'verified', updated_at = NOW()
       WHERE id = $1`,
      [groupId]
    );

    res.json({ success: true, siteVerificationStatus: 'verified' });
  } catch (error) {
    console.error('[verify-site] error', error);
    res.status(500).json({ error: 'Ошибка проверки сайта' });
  }
});

export default router;
