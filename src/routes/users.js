import express from 'express';
import { pool } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = express.Router();

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { rows } = await pool.query(
      'SELECT id, username, email, gender, google_sub, telegram_sub, avatar_url, display_name, password_hash FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'user_not_found' });
    const u = rows[0];
    return res.json({
      id: u.id,
      username: u.username,
      email: u.email,
      gender: u.gender,
      google_sub: u.google_sub,
      telegram_sub: u.telegram_sub,
      avatar_url: u.avatar_url,
      display_name: u.display_name,
      have_password: !!u.password_hash
    });
  } catch (err) {
    console.error('users_me_error', err);
    return res.status(500).json({ error: 'me_error' });
  }
});

router.put('/avatar', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { avatar } = req.body || {};
    if (!avatar) return res.status(400).json({ error: 'missing_avatar' });
    await pool.query('UPDATE users SET avatar_url=$1 WHERE id=$2', [avatar, userId]);
    return res.json({ success: true });
  } catch (err) {
    console.error('avatar_error', err);
    return res.status(500).json({ error: 'avatar_error' });
  }
});

router.patch('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { displayName } = req.body || {};
    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      return res.status(400).json({ error: 'invalid_display_name' });
    }
    if (displayName.length > 32) {
      return res.status(400).json({ error: 'display_name_too_long' });
    }
    const { rows } = await pool.query(
      `UPDATE users
         SET display_name = $1
       WHERE id = $2
       RETURNING id, username, email, display_name, google_sub, telegram_sub, avatar_url`,
      [displayName.trim(), userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'user_not_found' });
    return res.json({ user: rows[0] });
  } catch (err) {
    console.error('update_display_name_error', err);
    return res.status(500).json({ error: 'update_display_name_error' });
  }
});

export default router;

// 兼容舊版 /users/update（更新暱稱）
router.post('/update', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { display_name } = req.body || {};
    const name = typeof display_name === 'string' ? display_name.trim() : '';
    if (!name) return res.status(400).json({ error: 'invalid_display_name' });
    if (name.length > 32) return res.status(400).json({ error: 'display_name_too_long' });
    const { rows } = await pool.query(
      `UPDATE users
         SET display_name = $1
       WHERE id = $2
       RETURNING id, username, email, display_name, google_sub, telegram_sub, avatar_url`,
      [name, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'user_not_found' });
    return res.json({ user: rows[0] });
  } catch (err) {
    console.error('users_update_error', err);
    return res.status(500).json({ error: 'users_update_error' });
  }
});
