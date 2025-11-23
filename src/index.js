import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import recordsRouter from './routes/records.js';
import exchangesRouter from './routes/exchanges.js';
import balanceRouter from './routes/balance.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';

const app = express();
const allowlist = new Set([
  'http://localhost:3000',
  'https://y1ran.app',
  'https://www.y1ran.app'
]);

// 強制 UTF-8 輸出，避免缺少 charset 造成亂碼
app.use((req, res, next) => {
  if (!res.getHeader('Content-Type')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
  }
  next();
});

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

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/records', recordsRouter);
app.use('/exchanges', exchangesRouter);
app.use('/balance', balanceRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`backend running on ${port}`);
});
