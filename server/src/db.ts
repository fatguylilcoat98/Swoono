import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Swoono server uses the service_role key. It bypasses RLS. Never ship this
// key to the client — only the Express server reads SUPABASE_SERVICE_ROLE_KEY
// from the Render environment.

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let _client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!_client) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "[swoono] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. " +
          "Add them to Render env vars.",
      );
    }
    _client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

export function isDbConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

// --- Row types (match server/db/schema.sql) ------------------------------

export type RoomRow = {
  code: string;
  owner_client_ids: string[];
  created_at: string;
  last_activity_at: string;
};

export type RoomPeerRow = {
  room_code: string;
  client_id: string;
  display_name: string;
  first_joined_at: string;
  last_seen_at: string;
};

export type NoteRow = {
  id: string;
  room_code: string;
  author_client_id: string;
  author_name: string;
  /** Column is named `text` in the live DB — matches the working schema
   *  that's already been applied to the Supabase project. */
  text: string;
  color: string;
  created_at: string;
};

export type PointsEventRow = {
  id: string;
  room_code: string;
  client_id: string;
  delta: number;
  reason: string;
  created_at: string;
};

export type GameRecordRow = {
  id: string;
  room_code: string;
  game_id: string;
  winner_client_id: string | null;
  loser_client_id: string | null;
  outcome: "win" | "draw" | "coop-win" | "coop-loss";
  started_at: string;
  finished_at: string;
  meta: Record<string, unknown> | null;
};

export type RewardEventRow = {
  id: string;
  room_code: string;
  from_client_id: string;
  to_client_id: string;
  effect_id: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  delivered: boolean;
};

export type PeerLocationRow = {
  room_code: string;
  client_id: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  updated_at: string;
};

// --- Room operations ------------------------------------------------------

/**
 * Join semantics:
 * - If room doesn't exist, create it with this clientId as first owner.
 * - If room has 1 owner and requester is a new clientId, add as second owner.
 * - If room already has 2 owners, requester must be one of them — otherwise
 *   throw "room_locked".
 */
export async function joinRoom(
  code: string,
  clientId: string,
  displayName: string,
): Promise<{ room: RoomRow; peers: RoomPeerRow[] }> {
  const c = db();

  const { data: existing, error: selErr } = await c
    .from("rooms")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (selErr) throw selErr;

  let room: RoomRow;

  if (!existing) {
    // First person in. Create room with them as owner 1.
    const { data: created, error: insErr } = await c
      .from("rooms")
      .insert({
        code,
        owner_client_ids: [clientId],
        last_activity_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (insErr) throw insErr;
    room = created as RoomRow;
  } else {
    room = existing as RoomRow;
    const owners = room.owner_client_ids || [];
    if (owners.includes(clientId)) {
      // Returning owner — just bump activity.
    } else if (owners.length < 2) {
      // Open slot — claim it.
      const next = [...owners, clientId];
      const { data: updated, error: updErr } = await c
        .from("rooms")
        .update({
          owner_client_ids: next,
          last_activity_at: new Date().toISOString(),
        })
        .eq("code", code)
        .select("*")
        .single();
      if (updErr) throw updErr;
      room = updated as RoomRow;
    } else {
      // Room is full and requester is not an owner.
      const err = new Error("room_locked");
      err.name = "RoomLockedError";
      throw err;
    }
  }

  // Upsert peer row.
  const { error: peerErr } = await c.from("room_peers").upsert(
    {
      room_code: code,
      client_id: clientId,
      display_name: displayName,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "room_code,client_id" },
  );
  if (peerErr) throw peerErr;

  const { data: peers, error: peersErr } = await c
    .from("room_peers")
    .select("*")
    .eq("room_code", code);
  if (peersErr) throw peersErr;

  return { room, peers: (peers || []) as RoomPeerRow[] };
}

export async function touchRoom(code: string): Promise<void> {
  await db()
    .from("rooms")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("code", code);
}

// --- Notes ----------------------------------------------------------------

export async function listNotes(
  code: string,
  limit = 100,
): Promise<NoteRow[]> {
  const { data, error } = await db()
    .from("notes")
    .select("*")
    .eq("room_code", code)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []) as NoteRow[];
}

export async function insertNote(
  note: Omit<NoteRow, "id" | "created_at">,
): Promise<NoteRow> {
  const { data, error } = await db()
    .from("notes")
    .insert(note)
    .select("*")
    .single();
  if (error) throw error;
  return data as NoteRow;
}

// --- Points ---------------------------------------------------------------

export async function recordPoints(
  roomCode: string,
  clientId: string,
  delta: number,
  reason: string,
): Promise<void> {
  const { error } = await db().from("points_events").insert({
    room_code: roomCode,
    client_id: clientId,
    delta,
    reason,
  });
  if (error) throw error;
}

export async function pointsBalances(
  roomCode: string,
): Promise<Record<string, number>> {
  const { data, error } = await db()
    .from("points_events")
    .select("client_id, delta")
    .eq("room_code", roomCode);
  if (error) throw error;
  const balances: Record<string, number> = {};
  for (const row of data || []) {
    const r = row as { client_id: string; delta: number };
    balances[r.client_id] = (balances[r.client_id] || 0) + r.delta;
  }
  return balances;
}

// --- Game records ---------------------------------------------------------

export async function recordGame(
  row: Omit<GameRecordRow, "id" | "finished_at">,
): Promise<void> {
  const { error } = await db().from("game_records").insert(row);
  if (error) throw error;
}

export async function listGameRecords(
  roomCode: string,
  limit = 50,
): Promise<GameRecordRow[]> {
  const { data, error } = await db()
    .from("game_records")
    .select("*")
    .eq("room_code", roomCode)
    .order("finished_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as GameRecordRow[];
}

// --- Reward events --------------------------------------------------------

export async function logRewardEvent(
  row: Omit<RewardEventRow, "id" | "created_at" | "delivered"> & {
    delivered?: boolean;
  },
): Promise<void> {
  const { error } = await db().from("reward_events").insert({
    ...row,
    delivered: row.delivered ?? false,
  });
  if (error) throw error;
}

export async function listUndeliveredRewards(
  roomCode: string,
  toClientId: string,
): Promise<RewardEventRow[]> {
  const { data, error } = await db()
    .from("reward_events")
    .select("*")
    .eq("room_code", roomCode)
    .eq("to_client_id", toClientId)
    .eq("delivered", false)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as RewardEventRow[];
}

export async function markRewardsDelivered(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await db()
    .from("reward_events")
    .update({ delivered: true })
    .in("id", ids);
  if (error) throw error;
}

// --- Peer locations (distance feature) ------------------------------------

export async function updatePeerLocation(
  roomCode: string,
  clientId: string,
  lat: number,
  lng: number,
  accuracyM?: number,
): Promise<void> {
  const { error } = await db().from("peer_locations").upsert(
    {
      room_code: roomCode,
      client_id: clientId,
      lat,
      lng,
      accuracy_m: accuracyM ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "room_code,client_id" },
  );
  if (error) throw error;
}

export async function listPeerLocations(
  roomCode: string,
): Promise<PeerLocationRow[]> {
  const { data, error } = await db()
    .from("peer_locations")
    .select("*")
    .eq("room_code", roomCode);
  if (error) throw error;
  return (data || []) as PeerLocationRow[];
}

// Haversine distance in meters between two lat/lng pairs.
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
