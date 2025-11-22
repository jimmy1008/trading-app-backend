import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { verifyGoogleToken } from './auth.js';
import recordsRouter from './routes/records.js';
import exchangesRouter from './routes/exchanges.js';
import balanceRouter from './routes/balance.js';
import authRouter from './routes/auth.js';

const app = express();
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://y1ran.app',
    'https://www.y1ran.app'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.options('*', cors());
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
