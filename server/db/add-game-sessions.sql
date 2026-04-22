-- Game Sessions Table for Live Game State Persistence
--
-- Run this in Supabase SQL Editor after the main schema.sql

-- =============================================================
-- GAME SESSIONS (live game state)
-- =============================================================

CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  player1_id TEXT,
  player2_id TEXT,
  game_state JSONB DEFAULT '{}',
  current_turn TEXT,
  status TEXT DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable realtime
ALTER TABLE game_sessions REPLICA IDENTITY FULL;

-- Index for room lookups
CREATE INDEX IF NOT EXISTS idx_game_sessions_room
ON game_sessions(room_code);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_game_sessions_status
ON game_sessions(room_code, status);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER game_sessions_updated_at
  BEFORE UPDATE ON game_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;