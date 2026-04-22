-- Swoono Games Extension - 5 New Games + Daily Prompt
-- Run this in Supabase SQL Editor after main schema.sql

-- =============================================================
-- MEMORY THREADS (couples game)
-- =============================================================

CREATE TABLE IF NOT EXISTS memory_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  thread_title TEXT DEFAULT 'Our Story',
  entries JSONB DEFAULT '[]',
  created_by TEXT,
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for room lookups
CREATE INDEX IF NOT EXISTS idx_memory_threads_room
ON memory_threads(room_code);

-- Enable realtime
ALTER TABLE memory_threads REPLICA IDENTITY FULL;

-- Enable RLS
ALTER TABLE memory_threads ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- CARE PACKAGES (couples game)
-- =============================================================

CREATE TABLE IF NOT EXISTS care_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  from_id TEXT,
  to_id TEXT,
  message TEXT NOT NULL,
  emojis TEXT[] DEFAULT '{}',
  delivery_type TEXT DEFAULT 'now',
  delivery_date TIMESTAMPTZ,
  opened BOOLEAN DEFAULT false,
  is_emergency BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_care_packages_room_to
ON care_packages(room_code, to_id);

CREATE INDEX IF NOT EXISTS idx_care_packages_unopened
ON care_packages(room_code, to_id, opened);

-- Enable realtime
ALTER TABLE care_packages REPLICA IDENTITY FULL;

-- Enable RLS
ALTER TABLE care_packages ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- DAILY PROMPTS (free feature)
-- =============================================================

CREATE TABLE IF NOT EXISTS daily_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  prompt_date DATE NOT NULL,
  question TEXT NOT NULL,
  p1_answer TEXT,
  p2_answer TEXT,
  p1_submitted BOOLEAN DEFAULT false,
  p2_submitted BOOLEAN DEFAULT false,
  revealed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(room_code, prompt_date)
);

-- Index for date lookups
CREATE INDEX IF NOT EXISTS idx_daily_prompts_room_date
ON daily_prompts(room_code, prompt_date DESC);

-- Enable realtime
ALTER TABLE daily_prompts REPLICA IDENTITY FULL;

-- Enable RLS
ALTER TABLE daily_prompts ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- PROMPT BANK (question library)
-- =============================================================

CREATE TABLE IF NOT EXISTS prompt_bank (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with 30 questions
INSERT INTO prompt_bank (question, category) VALUES
('What made you smile today?', 'daily'),
('If you could be anywhere right now, where would you be?', 'imagination'),
('What song describes your mood today?', 'music'),
('What is one thing you wish your partner knew?', 'connection'),
('What are you looking forward to this week?', 'future'),
('What made you think of your partner today?', 'connection'),
('If today was a color, what would it be?', 'creative'),
('What is something small that made your day better?', 'gratitude'),
('What would your perfect Sunday look like?', 'dreams'),
('What is something you learned recently?', 'growth'),
('What habit are you proud of this week?', 'growth'),
('If you could change one thing about today, what would it be?', 'reflection'),
('What is your comfort food right now?', 'fun'),
('What movie do you want to watch together next?', 'together'),
('What is something your partner does that always makes you laugh?', 'love'),
('If you won the lottery tomorrow, what is the first thing you would do?', 'dreams'),
('What is a skill you want to learn this year?', 'growth'),
('What is your happiest memory from this month?', 'memory'),
('What would you do with a free day tomorrow?', 'fun'),
('What is something you are grateful for today?', 'gratitude'),
('What is one word that describes how you feel right now?', 'check-in'),
('What is a place you want to visit together?', 'adventure'),
('What is something that has been on your mind lately?', 'connection'),
('What is your favorite thing about your relationship?', 'love'),
('What made today different from yesterday?', 'reflection'),
('If you could have dinner with anyone, who would it be?', 'fun'),
('What is something you want to do before the end of the year?', 'goals'),
('What is a small act of kindness you witnessed today?', 'gratitude'),
('What is something you are working toward right now?', 'growth'),
('What would you tell your younger self today?', 'wisdom')
ON CONFLICT DO NOTHING;

-- Auto-update triggers for all tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to memory_threads (care_packages doesn't have updated_at)
CREATE TRIGGER memory_threads_updated_at
  BEFORE UPDATE ON memory_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();