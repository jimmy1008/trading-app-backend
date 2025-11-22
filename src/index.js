import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { verifyGoogleToken } from './auth.js';
import recordsRouter from './routes/records.js';
import exchangesRouter from './routes/exchanges.js';
import balanceRouter from './routes/balance.js';
import authRouter from './routes/auth.js';

const app = express();
const allowlist = new Set([
  'http://localhost:3000',
  'https://y1ran.app',
  'https://www.y1ran.app'
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowlist.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ ok: true });
});

app.post('/auth/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Missing idToken' });

    const data = await verifyGoogleToken(idToken);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

app.use('/auth', authRouter);
app.use('/records', recordsRouter);
app.use('/exchanges', exchangesRouter);
app.use('/balance', balanceRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`backend running on ${port}`);
});
