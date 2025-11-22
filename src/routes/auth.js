import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../db.js';

const router = express.Router();

function createTokenFor(user) {
  return jwt.sign(
    { userId: user.id, googleSub: user.google_sub },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, gender, inviteCode } = req.body || {};

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'missing_fields' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'password_too_short' });
    }

    const dupUser = await pool.query(
      'SELECT 1 FROM users WHERE username = $1',
      [username]
    );
    if (dupUser.rowCount > 0) {
      return res.status(400).json({ error: 'username_exists' });
    }

    const dupEmail = await pool.query(
      'SELECT 1 FROM users WHERE email = $1',
      [email]
    );
    if (dupEmail.rowCount > 0) {
      return res.status(400).json({ error: 'email_exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const googleSub = `local:${username}`;

    const insert = await pool.query(
      `INSERT INTO users (username, email, password_hash, google_sub, gender, invite_code, display_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, username, email, gender, google_sub`,
      [username, email, passwordHash, googleSub, gender || null, inviteCode || null, username]
    );

    const user = insert.rows[0];
    const token = createTokenFor(user);
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'register_error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    const identifier = email || username;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $1 LIMIT 1',
      [identifier]
    );
    const user = rows[0];
    if (!user) return res.status(400).json({ error: 'user_not_found' });
    if (!user.password_hash) {
      return res.status(400).json({ error: 'google_only_account' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'invalid_credentials' });

    const token = createTokenFor(user);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        gender: user.gender,
        google_sub: user.google_sub
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'login_error' });
  }
});

router.post('/telegram', async (req, res) => {
  try {
    const data = req.body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const maxAge = Number(process.env.TELEGRAM_LOGIN_MAX_AGE || 86400);

    if (!botToken) return res.status(500).json({ error: 'telegram_config' });
    if (!data || !data.hash || !data.auth_date) {
      return res.status(400).json({ error: 'telegram_invalid' });
    }

    const now = Math.floor(Date.now() / 1000);
    if (now - Number(data.auth_date) > maxAge) {
      return res.status(400).json({ error: 'telegram_expired' });
    }

    const { hash, ...rest } = data;
    const checkString = Object.keys(rest)
      .sort()
      .map(key => `${key}=${rest[key]}`)
      .join('\n');

    const secret = crypto.createHash('sha256').update(botToken).digest();
    const hmac = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
    if (hmac !== hash) return res.status(400).json({ error: 'telegram_invalid_hash' });

    const telegramId = String(data.id);
    const username = data.username || `tg_${telegramId}`;
    const email = data.username
      ? `${data.username}@telegram.local`
      : `${telegramId}@telegram.local`;
    const googleSub = `telegram:${telegramId}`;
    const displayName =
      [data.first_name, data.last_name].filter(Boolean).join(' ') ||
      data.username ||
      `tg_${telegramId}`;

    const existing = await pool.query(
      'SELECT * FROM users WHERE google_sub = $1 OR email = $2 LIMIT 1',
      [googleSub, email]
    );

    let user = existing.rows[0];
    if (!user) {
      const insert = await pool.query(
        `INSERT INTO users (username, email, password_hash, google_sub, display_name, avatar_url)
         VALUES ($1, $2, NULL, $3, $4, $5)
         RETURNING id, username, email, gender, google_sub`,
        [
          username,
          email,
          googleSub,
          displayName,
          data.photo_url || null
        ]
      );
      user = insert.rows[0];
    }

    const token = createTokenFor(user);
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'telegram_error' });
  }
});

export default router;
