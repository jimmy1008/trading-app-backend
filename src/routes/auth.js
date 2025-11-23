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

function authRequired(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const [, token] = auth.split(' ');
    if (!token) return res.status(401).json({ error: 'unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, gender, invite } = req.body || {};
    const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,16}$/;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'missing_fields' });
    }
    if (!passwordRule.test(password)) {
      return res.status(400).json({ error: 'weak_password' });
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

    try {
      const insert = await pool.query(
        `INSERT INTO users (username, email, password_hash, google_sub, gender, invite_code, display_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, username, email, gender, google_sub`,
        [username, email, passwordHash, googleSub, gender || null, invite || null, username]
      );
      const user = insert.rows[0];
      const token = createTokenFor(user);
      return res.json({ token, user });
    } catch (dbErr) {
      console.error('register_db_error', dbErr);
      return res.status(500).json({
        error: 'db_error',
        detail: dbErr.message
      });
    }
  } catch (err) {
    console.error('register_error', err);
    return res.status(500).json({ error: 'register_error', detail: err.message });
  }
});

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body || {};

    if (!credential) {
      return res.status(400).json({ error: 'missing_credential' });
    }

    const payload = JSON.parse(
      Buffer.from(credential.split('.')[1], 'base64').toString()
    );

    const googleSub = payload.sub;
    const email = payload.email;

    if (!googleSub || !email) {
      return res.status(400).json({ error: 'invalid_google_payload' });
    }

    const exist = await pool.query(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    const user = exist.rows[0];

    // 沒有帳號 → 需要先註冊/綁定
    if (!user) {
      return res.status(400).json({ error: 'google_not_bound' });
    }

    // 有帳號但沒綁定或綁定不一致
    if (!user.google_sub || user.google_sub !== googleSub) {
      return res.status(400).json({ error: 'google_not_bound' });
    }

    const token = createTokenFor(user);
    return res.json({ token, user });
  } catch (err) {
    console.error('google_error', err);
    return res.status(500).json({ error: 'google_error' });
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
    console.error('login_error', err);
    res.status(500).json({ error: 'login_error', detail: err.message });
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
    const telegramSub = `telegram:${telegramId}`;
    const displayName =
      [data.first_name, data.last_name].filter(Boolean).join(' ') ||
      data.username ||
      `tg_${telegramId}`;

    const existing = await pool.query(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    if (existing.rowCount === 0) {
      return res.status(400).json({ error: 'telegram_not_bound' });
    }

    const user = existing.rows[0];

    if (!user.telegram_sub || user.telegram_sub !== telegramSub) {
      return res.status(400).json({ error: 'telegram_not_bound' });
    }

    const token = createTokenFor(user);
    return res.json({ token, user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'telegram_error' });
  }
});

router.post('/bind/google', authRequired, async (req, res) => {
  try {
    const { credential } = req.body || {};
    if (!credential) return res.status(400).json({ error: 'missing_credential' });

    const payload = JSON.parse(
      Buffer.from(credential.split('.')[1], 'base64').toString()
    );
    const googleSub = payload.sub;
    const email = payload.email;

    if (!googleSub || !email) {
      return res.status(400).json({ error: 'invalid_google_payload' });
    }

    const userId = req.user.userId;
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = rows[0];
    if (!user) return res.status(400).json({ error: 'user_not_found' });
    if (user.email !== email) {
      return res.status(400).json({ error: 'email_mismatch' });
    }

    await pool.query('UPDATE users SET google_sub = $1 WHERE id = $2', [googleSub, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'bind_google_error' });
  }
});

router.post('/bind/telegram', authRequired, async (req, res) => {
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
    const telegramSub = `telegram:${telegramId}`;
    const userId = req.user.userId;

    await pool.query('UPDATE users SET telegram_sub = $1 WHERE id = $2', [telegramSub, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'bind_telegram_error' });
  }
});

router.get('/me', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { rows } = await pool.query(
      'SELECT id, username, email, gender, google_sub, telegram_sub, password_hash, avatar_url FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'user_not_found' });
    const user = rows[0];
    return res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      gender: user.gender,
      google_sub: user.google_sub,
      telegram_sub: user.telegram_sub,
      avatar_url: user.avatar_url,
      have_password: !!user.password_hash
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'me_error' });
  }
});

export default router;
