import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { pool } from './db.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function verifyGoogleToken(idToken) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();
  const googleSub = payload.sub;
  const email = payload.email;
  const name = payload.name;
  const picture = payload.picture;

  const { rows } = await pool.query(
    `
    INSERT INTO users (google_sub, email, display_name, avatar_url)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (google_sub)
    DO UPDATE SET
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      avatar_url = EXCLUDED.avatar_url
    RETURNING id, google_sub, email, display_name, avatar_url;
    `,
    [googleSub, email, name, picture]
  );

  const user = rows[0];

  const token = jwt.sign(
    {
      userId: user.id,
      googleSub: user.google_sub
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { user, token };
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [, token] = authHeader.split(' ');

  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
