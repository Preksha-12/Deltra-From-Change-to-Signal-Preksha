-- Enable pgcrypto for gen_random_uuid if on older Postgres versions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Watchlist items per user
CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, symbol)
);

-- Per-user "read cursor" per symbol — the basis of "what changed since last check"
CREATE TABLE IF NOT EXISTS user_symbol_state (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  last_seen_price NUMERIC,
  last_seen_at TIMESTAMPTZ,
  last_seen_volume BIGINT,
  PRIMARY KEY (user_id, symbol)
);

-- Durable log of detected significant events (survives offline users)
CREATE TABLE IF NOT EXISTS significance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  event_type TEXT NOT NULL,        -- 'price_move' | 'volume_spike' | 'level_break' | 'composite'
  score NUMERIC NOT NULL,
  detail JSONB,
  detected_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_symbol_time ON significance_events(symbol, detected_at DESC);

-- Durable snapshot of last known price (Redis is hot cache; this survives restarts)
CREATE TABLE IF NOT EXISTS symbol_snapshots (
  symbol TEXT PRIMARY KEY,
  last_price NUMERIC,
  last_volume BIGINT,
  source TEXT,
  updated_at TIMESTAMPTZ
);
