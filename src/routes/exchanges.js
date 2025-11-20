import express from 'express';
import { pool } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { rows } = await pool.query(
    `SELECT ue.id, ex.code, ex.name, ue.api_key, ue.api_secret, ue.passphrase
     FROM user_exchanges ue
     JOIN exchanges ex ON ue.exchange_id = ex.id
     WHERE ue.user_id = $1`,
    [userId]
  );
  res.json(rows);
});

router.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { code, api_key, api_secret, passphrase } = req.body;

  const ex = await pool.query(
    `SELECT id FROM exchanges WHERE code=$1`,
    [code]
  );
  if (!ex.rows.length) return res.status(400).json({ error: 'Invalid exchange' });

  const exchangeId = ex.rows[0].id;

  const { rows } = await pool.query(
    `INSERT INTO user_exchanges (user_id, exchange_id, api_key, api_secret, passphrase)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, exchange_id)
     DO UPDATE SET api_key=$3, api_secret=$4, passphrase=$5
     RETURNING *`,
    [userId, exchangeId, api_key, api_secret, passphrase]
  );

  res.json(rows[0]);
});

router.delete('/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const userId = req.user.userId;

  const result = await pool.query(
    `DELETE FROM user_exchanges WHERE id=$1 AND user_id=$2`,
    [id, userId]
  );

  if (result.rowCount === 0)
    return res.status(404).json({ error: 'Not found' });

  res.json({ success: true });
});

export default router;
