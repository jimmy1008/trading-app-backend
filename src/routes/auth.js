import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const router = express.Router();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://y1ran.app';
const TELEGRAM_LOGIN_MAX_AGE = Number(process.env.TELEGRAM_LOGIN_MAX_AGE || 86400);

const SECRET = TELEGRAM_BOT_TOKEN
  ? crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest()
  : null;

function checkTelegramAuth(data = {}) {
  if (!SECRET) return false;
  const { hash, ...rest } = data;
  if (!hash) return false;
  const checkString = Object.keys(rest)
    .sort()
    .map(key => `${key}=${rest[key]}`)
    .join('\n');

  const hmac = crypto.createHmac('sha256', SECRET).update(checkString).digest('hex');
  return hmac === hash;
}

function createTokenFor(user) {
  return jwt.sign(
    {
      userId: user.id,
      telegramId: user.telegram_id
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Telegram Login callback (Widget auth_url)
router.get('/telegram', async (req, res) => {
  try {
    const {
      hash,
      id,
      username,
      first_name,
      last_name,
      photo_url,
      auth_date,
      ...extra
    } = req.query;

    if (!hash || !id || !auth_date) {
      return redirectWithError('telegram_invalid', res);
    }

    if (!TELEGRAM_BOT_TOKEN) {
      console.error('TELEGRAM_BOT_TOKEN is not set');
      return redirectWithError('telegram_config', res);
    }

    const now = Math.floor(Date.now() / 1000);
    if (now - Number(auth_date) > TELEGRAM_LOGIN_MAX_AGE) {
      return redirectWithError('telegram_expired', res);
    }

    const data = {
      id,
      username,
      first_name,
      last_name,
      photo_url,
      auth_date,
      ...extra
    };

    const dataCheckString = Object.keys(data)
      .filter(key => data[key] !== undefined && data[key] !== null)
      .sort()
      .map(key => `${key}=${data[key]}`)
      .join('\n');

    const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (hmac !== hash) {
      console.warn('Telegram login: invalid hash');
      return redirectWithError('telegram_invalid_hash', res);
    }

    const existing = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [id]);
    let user = existing.rows[0];

    const displayName =
      username || [first_name, last_name].filter(Boolean).join(' ') || `tg_${id}`;

    if (!user) {
      const inserted = await pool.query(
        `INSERT INTO users (telegram_id, telegram_username, display_name, avatar_url)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [id, username || null, displayName, photo_url || null]
      );
      user = inserted.rows[0];
    } else {
      await pool.query(
        `UPDATE users
           SET telegram_username = COALESCE($2, telegram_username),
               display_name = COALESCE($3, display_name),
               avatar_url = COALESCE($4, avatar_url)
         WHERE id = $1`,
        [user.id, username || null, displayName, photo_url || null]
      );
      const refreshed = await pool.query('SELECT * FROM users WHERE id = $1', [user.id]);
      user = refreshed.rows[0];
    }

    const token = createTokenFor(user);
    const successUrl = new URL('/index.html', FRONTEND_URL);
    successUrl.searchParams.set('token', token);
    return res.redirect(302, successUrl.toString());
  } catch (err) {
    console.error('Telegram auth error:', err);
    return redirectWithError('telegram_error', res);
  }
});

router.post('/telegram', async (req, res) => {
  try {
    const data = req.body || {};

    if (!TELEGRAM_BOT_TOKEN) {
      return res.status(500).json({ error: 'telegram_config' });
    }

    if (!data.hash || !data.auth_date) {
      return res.status(400).json({ error: 'telegram_invalid' });
    }

    const authDate = Number.parseInt(data.auth_date, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Number.isNaN(authDate) || now - authDate > TELEGRAM_LOGIN_MAX_AGE) {
      return res.status(400).json({ error: 'telegram_expired' });
    }

    const { hash, ...checkData } = data;
    const checkString = Object.keys(checkData)
      .sort()
      .map(key => `${key}=${checkData[key]}`)
      .join('\n');

    const secret = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
    const hmac = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

    if (hmac !== hash) {
      return res.status(400).json({ error: 'telegram_invalid_hash' });
    }

    const telegramId = String(data.id);
    const username = data.username || `tg_${telegramId}`;
    const displayName =
      [data.first_name, data.last_name].filter(Boolean).join(' ') || username;

    let user = (await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]))
      .rows[0];

    if (!user) {
      const inserted = await pool.query(
        `INSERT INTO users (username, telegram_id, display_name)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [username, telegramId, displayName]
      );
      user = inserted.rows[0];
    }

    const token = createTokenFor(user);
    return res.json({ token, user });
  } catch (err) {
    console.error('Telegram auth error', err);
    return res.status(500).json({ error: 'telegram_error' });
  }
});

function redirectWithError(code, res) {
  const loginUrl = new URL('/login.html', FRONTEND_URL);
  loginUrl.searchParams.set('error', code);
  return res.redirect(302, loginUrl.toString());
}

export default router;
