-- Swoono Supabase schema v1 (persistence, no auth yet)
--
-- Run this in the Supabase SQL Editor once after creating the project.
-- Rerunning is safe: every create uses IF NOT EXISTS.
--
-- Identity model for v1:
--   Each device has an opaque `client_id` (stored in localStorage on the web
--   client). Rooms are locked to the first two client_ids that join them.
--   When we add real auth in v2, a `users` table + `user_id` FK columns will
--   be added alongside client_id, and we'll migrate in-place.

-- --------------------------------------------------------------------------
-- Rooms: the central unit. One couple = one room.
-- --------------------------------------------------------------------------
create table if not exists rooms (
  code text primary key,
  -- First two client_ids to join become the permanent owners. Length 0 = open,
  -- length 1 = waiting for partner, length 2 = locked.
  owner_client_ids text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create index if not exists rooms_last_activity_idx
  on rooms (last_activity_at);

-- --------------------------------------------------------------------------
-- Room peers: persistent member roster. Display name lives here so reconnects
-- don't reset it. Only rows for clientIds in rooms.owner_client_ids are valid
-- once a room is locked.
-- --------------------------------------------------------------------------
create table if not exists room_peers (
  room_code text not null references rooms(code) on delete cascade,
  client_id text not null,
  display_name text not null,
  first_joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_code, client_id)
);

-- --------------------------------------------------------------------------
-- Sticky notes. Persisted, ordered by created_at.
-- --------------------------------------------------------------------------
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references rooms(code) on delete cascade,
  author_client_id text not null,
  author_name text not null,
  text text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create index if not exists notes_room_created_idx
  on notes (room_code, created_at desc);

-- --------------------------------------------------------------------------
-- Points ledger: immutable append-only log. Balance = sum(delta).
-- --------------------------------------------------------------------------
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

-- --------------------------------------------------------------------------
-- Game records: one row per completed game. Drives leaderboard + history.
-- --------------------------------------------------------------------------
create table if not exists game_records (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references rooms(code) on delete cascade,
  game_id text not null,
  winner_client_id text,     -- null if draw or cooperative win/loss
  loser_client_id text,      -- null if draw or cooperative
  outcome text not null,     -- 'win' | 'draw' | 'coop-win' | 'coop-loss'
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  meta jsonb
);

create index if not exists game_records_room_finished_idx
  on game_records (room_code, finished_at desc);
create index if not exists game_records_room_game_idx
  on game_records (room_code, game_id);

-- --------------------------------------------------------------------------
-- Reward events: log of gestures (kiss, slap, fireworks, 11 trophies).
-- Stored so the receiver sees a history even if they were offline when sent.
-- --------------------------------------------------------------------------
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
create index if not exists reward_events_undelivered_idx
  on reward_events (room_code, to_client_id) where delivered = false;

-- --------------------------------------------------------------------------
-- Peer locations: latest coordinate per peer. Distance-apart feature.
-- One row per (room, client_id). Server computes haversine from both rows.
-- Raw coords never leave the server — only the computed distance does.
-- --------------------------------------------------------------------------
create table if not exists peer_locations (
  room_code text not null references rooms(code) on delete cascade,
  client_id text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m double precision,
  updated_at timestamptz not null default now(),
  primary key (room_code, client_id)
);

-- --------------------------------------------------------------------------
-- Row Level Security
--
-- v1 note: The server uses the service_role key (bypasses RLS entirely). The
-- anon key is never used by the client for direct DB reads — all DB traffic
-- flows through our Express server, which enforces room ownership in code.
--
-- We still enable RLS as a defense-in-depth guard against accidental anon
-- access. When v2 adds real auth, we'll replace these policies with proper
-- user-scoped ones.
-- --------------------------------------------------------------------------
alter table rooms          enable row level security;
alter table room_peers     enable row level security;
alter table notes          enable row level security;
alter table points_events  enable row level security;
alter table game_records   enable row level security;
alter table reward_events  enable row level security;
alter table peer_locations enable row level security;

-- No policies defined → anon role has zero access. service_role bypasses RLS.
