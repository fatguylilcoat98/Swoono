-- Swoono Supabase schema v2 (bulletproof rewrite)
--
-- HOW TO RUN
--   1. Open https://supabase.com/dashboard, pick the Swoono project
--   2. Left sidebar: SQL Editor
--   3. New query
--   4. Paste this ENTIRE file
--   5. Click Run
--   6. Expect: Success. No rows returned.
--
-- If the whole file fails, paste one section at a time (sections
-- are marked with == lines) and tell me which section fails.
-- Each section is self-contained and safe to re-run.

-- =============================================================
-- 1. EXTENSIONS (required for gen_random_uuid)
-- =============================================================

create extension if not exists pgcrypto;

-- =============================================================
-- 2. ROOMS
-- =============================================================

create table if not exists rooms (
  code text primary key,
  owner_client_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create index if not exists rooms_last_activity_idx
  on rooms (last_activity_at);

-- =============================================================
-- 3. ROOM PEERS
-- =============================================================

create table if not exists room_peers (
  room_code text not null references rooms(code) on delete cascade,
  client_id text not null,
  display_name text not null,
  first_joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_code, client_id)
);

-- =============================================================
-- 4. NOTES
-- =============================================================

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references rooms(code) on delete cascade,
  author_client_id text not null,
  author_name text not null,
  body text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create index if not exists notes_room_created_idx
  on notes (room_code, created_at desc);

-- =============================================================
-- 5. POINTS EVENTS
-- =============================================================

create table if not exists points_events (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references rooms(code) on delete cascade,
  client_id text not null,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists points_events_room_client_idx
  on points_events (room_code, client_id, created_at desc);

-- =============================================================
-- 6. GAME RECORDS
-- =============================================================

create table if not exists game_records (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references rooms(code) on delete cascade,
  game_id text not null,
  winner_client_id text,
  loser_client_id text,
  outcome text not null,
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  meta jsonb
);

create index if not exists game_records_room_finished_idx
  on game_records (room_code, finished_at desc);

create index if not exists game_records_room_game_idx
  on game_records (room_code, game_id);

-- =============================================================
-- 7. REWARD EVENTS
-- =============================================================

create table if not exists reward_events (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references rooms(code) on delete cascade,
  from_client_id text not null,
  to_client_id text not null,
  effect_id text not null,
  payload jsonb,
  created_at timestamptz not null default now(),
  delivered boolean not null default false
);

create index if not exists reward_events_room_created_idx
  on reward_events (room_code, created_at desc);

-- =============================================================
-- 8. PEER LOCATIONS (distance-apart feature)
-- =============================================================

create table if not exists peer_locations (
  room_code text not null references rooms(code) on delete cascade,
  client_id text not null,
  lat double precision not null,
  lng double precision not null,
  accuracy_m double precision,
  updated_at timestamptz not null default now(),
  primary key (room_code, client_id)
);

-- =============================================================
-- 9. ROW LEVEL SECURITY
-- =============================================================
-- The Swoono server uses the service_role key which bypasses RLS.
-- The anon key is never used by the client for direct DB reads.
-- RLS is enabled with NO policies as a defense-in-depth guard so
-- the anon role cannot accidentally read anything.

alter table rooms enable row level security;
alter table room_peers enable row level security;
alter table notes enable row level security;
alter table points_events enable row level security;
alter table game_records enable row level security;
alter table reward_events enable row level security;
alter table peer_locations enable row level security;
