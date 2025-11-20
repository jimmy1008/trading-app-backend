INSERT INTO exchanges (code, name) VALUES
  ('binance', 'Binance'),
  ('bybit', 'Bybit'),
  ('bitget', 'Bitget'),
  ('okx', 'OKX'),
  ('bingx', 'BingX'),
  ('mexc', 'MEXC'),
  ('gate', 'Gate.io')
ON CONFLICT DO NOTHING;
