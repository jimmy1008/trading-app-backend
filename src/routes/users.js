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

export default router;
