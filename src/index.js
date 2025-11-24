import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import recordsRouter from './routes/records.js';
import exchangesRouter from './routes/exchanges.js';
import balanceRouter from './routes/balance.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';

const app = express();

// 強制 UTF-8 輸出，並避免重複壓縮
app.use((req, res, next) => {
  if (!res.getHeader('Content-Type')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
  }
  res.setHeader('Content-Encoding', 'identity');
  next();
});

// CORS：允許本地與正式網域
app.use(cors({
  origin: ['http://localhost:3000', 'https://y1ran.app', 'https://www.y1ran.app'],
  credentials: true
}));

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ ok: true });
});

// 假資料 Portfolio
app.get('/portfolio', (req, res) => {
  return res.json({
    status: 'ok',
    data: [
      { time: '2025-01-01', value: 1000 },
      { time: '2025-01-02', value: 1030 },
      { time: '2025-01-03', value: 980 },
      { time: '2025-01-04', value: 1100 }
    ],
    positions: [
      { symbol: 'BTC', value_usdt: 500 },
      { symbol: 'ETH', value_usdt: 300 },
      { symbol: 'SOL', value_usdt: 200 }
    ]
  });
});

// 假資料 Exchanges
app.get('/exchanges', (req, res) => {
  return res.json({
    status: 'ok',
    exchanges: ['binance', 'bybit', 'bitget', 'okx', 'bingx', 'mexc', 'gate'],
    list: [
      { code: 'binance', name: 'Binance' },
      { code: 'bybit', name: 'Bybit' },
      { code: 'bitget', name: 'Bitget' },
      { code: 'okx', name: 'OKX' },
      { code: 'bingx', name: 'BingX' },
      { code: 'mexc', name: 'MEXC' },
      { code: 'gate', name: 'Gate.io' }
    ]
  });
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
