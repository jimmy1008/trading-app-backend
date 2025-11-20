import express from "express";
import crypto from "crypto";
import { pool } from "../db.js";
import { authMiddleware } from "../auth.js";
import fetch from "node-fetch";

const router = express.Router();

async function getUserExchange(userId, code) {
  const { rows } = await pool.query(
    `SELECT ue.api_key, ue.api_secret, ue.passphrase
     FROM user_exchanges ue
     JOIN exchanges ex ON ue.exchange_id = ex.id
     WHERE ue.user_id=$1 AND ex.code=$2`,
    [userId, code]
  );
  return rows[0] || null;
}

router.get("/binance", authMiddleware, async (req, res) => {
  try {
    const user = await getUserExchange(req.user.userId, "binance");
    if (!user) return res.json({ success: false });

    const timestamp = Date.now();
    const query = `timestamp=${timestamp}`;
    const signature = crypto
      .createHmac("sha256", user.api_secret)
      .update(query)
      .digest("hex");

    const url = `https://api.binance.com/sapi/v1/capital/config/getall?${query}&signature=${signature}`;

    const apiRes = await fetch(url, { headers: { "X-MBX-APIKEY": user.api_key } });
    const data = await apiRes.json();

    let totalUSDT = 0;
    data.forEach(a => {
      totalUSDT += parseFloat(a.free || 0) + parseFloat(a.locked || 0);
    });

    res.json({ success: true, exchange: "binance", totalUSDT, assets: data });
  } catch (e) {
    res.json({ success: false });
  }
});

router.get("/bybit", authMiddleware, async (req, res) => {
  try {
    const user = await getUserExchange(req.user.userId, "bybit");
    if (!user) return res.json({ success: false });

    const timestamp = Date.now().toString();
    const api_key = user.api_key;
    const api_secret = user.api_secret;

    const recvWindow = "5000";
    const signString = `api_key=${api_key}&recv_window=${recvWindow}&timestamp=${timestamp}`;
    const signature = crypto
      .createHmac("sha256", api_secret)
      .update(signString)
      .digest("hex");

    const url = `https://api.bybit.com/v5/asset/transfer/query-asset-info?${signString}&sign=${signature}`;

    const apiRes = await fetch(url);
    const result = await apiRes.json();

    let totalUSDT = 0;
    if (result.result?.list) {
      result.result.list.forEach(asset => {
        if (asset.coin === "USDT") totalUSDT += parseFloat(asset.walletBalance || 0);
      });
    }

    res.json({ success: true, exchange: "bybit", totalUSDT, assets: result });
  } catch (e) {
    res.json({ success: false });
  }
});

router.get("/bitget", authMiddleware, async (req, res) => {
  try {
    const user = await getUserExchange(req.user.userId, "bitget");
    if (!user) return res.json({ success: false });

    const timestamp = Date.now().toString();
    const preSign = timestamp + "GET" + "/api/v2/spot/account/assets";
    const signature = crypto
      .createHmac("sha256", user.api_secret)
      .update(preSign)
      .digest("base64");

    const url = "https://api.bitget.com/api/v2/spot/account/assets";

    const apiRes = await fetch(url, {
      headers: {
        "ACCESS-KEY": user.api_key,
        "ACCESS-SIGN": signature,
        "ACCESS-TIMESTAMP": timestamp
      }
    });
    const data = await apiRes.json();

    let totalUSDT = 0;
    data.data?.forEach(a => {
      if (a.coin === "USDT") totalUSDT += parseFloat(a.available || 0);
    });

    res.json({ success: true, exchange: "bitget", totalUSDT, assets: data });
  } catch (e) {
    res.json({ success: false });
  }
});

router.get("/okx", authMiddleware, async (req, res) => {
  try {
    const user = await getUserExchange(req.user.userId, "okx");
    if (!user) return res.json({ success: false });

    const timestamp = (new Date()).toISOString();
    const method = "GET";
    const requestPath = "/api/v5/account/balance";
    const message = timestamp + method + requestPath;
    const signature = crypto
      .createHmac("sha256", user.api_secret)
      .update(message)
      .digest("base64");

    const apiRes = await fetch("https://www.okx.com" + requestPath, {
      headers: {
        "OK-ACCESS-KEY": user.api_key,
        "OK-ACCESS-SIGN": signature,
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": user.passphrase
      }
    });
    const data = await apiRes.json();

    let totalUSDT = 0;
    data.data?.[0]?.details?.forEach(d => {
      if (d.ccy === "USDT") totalUSDT += parseFloat(d.cashBal || 0);
    });

    res.json({ success: true, exchange: "okx", totalUSDT, assets: data });
  } catch (e) {
    res.json({ success: false });
  }
});

router.get("/bingx", authMiddleware, async (req, res) => {
  try {
    const user = await getUserExchange(req.user.userId, "bingx");
    if (!user) return res.json({ success: false });

    const timestamp = Date.now().toString();
    const method = "GET";
    const path = "/openApi/wallets/v1/all-asset";
    const preSign = `${path}?timestamp=${timestamp}`;
    const signature = crypto
      .createHmac("sha256", user.api_secret)
      .update(preSign)
      .digest("hex");

    const url = `https://open-api.bingx.com${path}?timestamp=${timestamp}&signature=${signature}`;

    const apiRes = await fetch(url, {
      headers: { "X-BX-APIKEY": user.api_key }
    });
    const data = await apiRes.json();

    let totalUSDT = 0;
    data.data?.forEach(a => {
      if (a.asset === "USDT") totalUSDT += parseFloat(a.balance || 0);
    });

    res.json({ success: true, exchange: "bingx", totalUSDT, assets: data });
  } catch (e) {
    res.json({ success: false });
  }
});

router.get("/mexc", authMiddleware, async (req, res) => {
  try {
    const user = await getUserExchange(req.user.userId, "mexc");
    if (!user) return res.json({ success: false });

    const timestamp = Date.now();
    const query = `timestamp=${timestamp}`;
    const signature = crypto
      .createHmac("sha256", user.api_secret)
      .update(query)
      .digest("hex");

    const url = `https://api.mexc.com/api/v3/account?${query}&signature=${signature}`;

    const apiRes = await fetch(url, {
      headers: { "X-MEXC-APIKEY": user.api_key }
    });
    const data = await apiRes.json();

    let totalUSDT = 0;
    data.balances?.forEach(a => {
      if (a.asset === "USDT") totalUSDT += parseFloat(a.free || 0);
    });

    res.json({ success: true, exchange: "mexc", totalUSDT, assets: data });
  } catch (e) {
    res.json({ success: false });
  }
});

router.get("/gate", authMiddleware, async (req, res) => {
  try {
    const user = await getUserExchange(req.user.userId, "gate");
    if (!user) return res.json({ success: false });

    const timestamp = (Date.now() / 1000).toString();
    const signature = crypto
      .createHmac("sha512", user.api_secret)
      .update(timestamp + "GET" + "/api/v4/wallet/total_balance")
      .digest("hex");

    const url = `https://api.gateio.ws/api/v4/wallet/total_balance`;

    const apiRes = await fetch(url, {
      headers: {
        KEY: user.api_key,
        SIGN: signature,
        Timestamp: timestamp
      }
    });

    const data = await apiRes.json();

    const totalUSDT = parseFloat(data.total?.USDT || 0);

    res.json({ success: true, exchange: "gate", totalUSDT, assets: data });
  } catch (e) {
    res.json({ success: false });
  }
});

router.get("/summary", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const exchanges = ["binance", "bybit", "bitget", "okx", "bingx", "mexc", "gate"];

  const results = {};
  let total = 0;

  for (const ex of exchanges) {
    try {
      const r = await fetch(`${process.env.BASE_URL}/balance/${ex}`, {
        headers: {
          Authorization: req.headers.authorization || ""
        }
      });

      const data = await r.json();
      if (data.success) {
        results[ex] = data.totalUSDT;
        total += data.totalUSDT;
      } else {
        results[ex] = 0;
      }
    } catch (err) {
      results[ex] = 0;
    }
  }

  res.json({
    success: true,
    total,
    exchanges: results
  });
});

export default router;
