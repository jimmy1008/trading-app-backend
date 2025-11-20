CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  google_sub VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE trade_records (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(32) NOT NULL,
  side VARCHAR(8),
  result VARCHAR(32),
  leverage INTEGER,
  margin_usdt NUMERIC(18,4),
  pnl_usdt NUMERIC(18,4),
  pnl_pct NUMERIC(10,4),
  summary TEXT,
  tags TEXT[],
  traded_at TIMESTAMP,
  image_url TEXT,
  extra_fields JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE exchanges (
  id SERIAL PRIMARY KEY,
  code VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(64) NOT NULL
);

INSERT INTO exchanges (code, name) VALUES
  ('binance', 'Binance'),
  ('bybit', 'Bybit'),
  ('bitget', 'Bitget'),
  ('okx', 'OKX'),
  ('bingx', 'BingX'),
  ('mexc', 'MEXC'),
  ('gate', 'Gate.io')
ON CONFLICT DO NOTHING;

CREATE TABLE user_exchanges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange_id INTEGER NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL,
  api_secret TEXT NOT NULL,
  passphrase TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, exchange_id)
);


