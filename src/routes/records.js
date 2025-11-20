import express from 'express';
import { pool } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = express.Router();

// 取得使用者全部紀錄
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { rows } = await pool.query(
    `SELECT * FROM trade_records 
     WHERE user_id = $1
     ORDER BY traded_at DESC NULLS LAST, created_at DESC
     LIMIT 500`,
    [userId]
  );
  res.json(rows);
});

// 取得單筆紀錄
router.get('/:id', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const id = Number(req.params.id);

  const { rows } = await pool.query(
    `SELECT * FROM trade_records 
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// 新增紀錄
router.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const {
    symbol, side, result, leverage,
    margin_usdt, pnl_usdt, pnl_pct,
    summary, tags, traded_at, image_url, extra_fields
  } = req.body;

  const { rows } = await pool.query(
    `INSERT INTO trade_records 
      (user_id, symbol, side, result, leverage,
       margin_usdt, pnl_usdt, pnl_pct,
       summary, tags, traded_at, image_url, extra_fields)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      userId, symbol, side, result, leverage,
      margin_usdt, pnl_usdt, pnl_pct,
      summary, tags, traded_at, image_url, extra_fields
    ]
  );

  res.status(201).json(rows[0]);
});

// 更新紀錄
router.put('/:id', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const id = Number(req.params.id);

  const {
    symbol, side, result, leverage,
    margin_usdt, pnl_usdt, pnl_pct,
    summary, tags, traded_at, image_url, extra_fields
  } = req.body;

  const { rows } = await pool.query(
    `UPDATE trade_records SET
       symbol = $1,
       side = $2,
       result = $3,
       leverage = $4,
       margin_usdt = $5,
       pnl_usdt = $6,
       pnl_pct = $7,
       summary = $8,
       tags = $9,
       traded_at = $10,
       image_url = $11,
       extra_fields = $12,
       updated_at = NOW()
     WHERE id = $13 AND user_id = $14
     RETURNING *`,
    [
      symbol, side, result, leverage,
      margin_usdt, pnl_usdt, pnl_pct,
      summary, tags, traded_at, image_url, extra_fields,
      id, userId
    ]
  );

  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// 刪除紀錄
router.delete('/:id', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const id = Number(req.params.id);

  const result = await pool.query(
    `DELETE FROM trade_records
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  if (result.rowCount === 0)
    return res.status(404).json({ error: 'Not found' });

  res.json({ success: true });
});

export default router;
