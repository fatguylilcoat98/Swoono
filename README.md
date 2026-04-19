# Swoono

A synced shared room for two people. Send post-it notes, play games, earn points, redeem playful rewards. Romantic, playful, slightly futuristic.

> Spelling: S-W-O-O-N-O. The final "O" is a heart.

## Phase 1 status

This is the clean rebuild foundation. What's real:

- Landing screen + heart-grows-at-viewer transition
- Room entry (create or join with a 4–6 char code)
- Two-person synced room over Socket.IO
- Shared post-it notes (live sync, animated splash-in)
- Canvas particle background with a simulated beat pulse
- Presence / waiting-for-partner state
- Rejoin-safe reconnect (sticky `clientId` in localStorage)

What's placeholder (stubs only, ready to plug into):

- Games menu + game registry (Tic-Tac-Toe, Hangman, Battleship slots)
- Rewards catalog + points economy + effect payload dispatcher
- Leaderboard panel + tier/unlock system
- Audio adapter (simulated beat today → real provider later)

See `INTEGRATION_NOTES` at the bottom of this file for how existing work
(Battleship, animations, future music provider) plugs into the architecture.

## Stack

- **Client:** Vite + React 18 + TypeScript + Tailwind + Framer Motion + Zustand + socket.io-client
- **Server:** Express + Socket.IO with Supabase persistence
- **Deployment:** one Render web service — Express serves Socket.IO *and* the built client
- **Monorepo:** npm workspaces (`client`, `server`)

## Run locally

Requires Node 20+.

```bash
npm install
npm run dev:server      # terminal 1 — Express + Socket.IO on :3001
npm run dev:client      # terminal 2 — Vite dev server on :5173 with /socket.io proxied
```

Open http://localhost:5173 in two tabs, join the same room code, and you
should see live presence, notes, and particles.

## Build & run like Render does

```bash
npm install
npm run build           # builds client -> client/dist AND server -> server/dist
npm start               # node server/dist/index.js — serves both API + static
```

Then open http://localhost:3001.

## Deploy to Render

### Step 1: Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the schema in `server/db/schema.sql`
3. Go to **Settings** → **API** and copy:
   - Project URL (looks like `https://xxxxx.supabase.co`)
   - Service Role Key (secret key, **not** the anon key)

### Step 2: Deploy to Render

The repo includes `render.yaml`. Create a new Web Service on Render, connect
the GitHub repo, and Render picks up the service automatically:

- **Build:** `npm install && npm run build`
- **Start:** `npm start`
- **Plan:** free (good for two-person testing; spins down after 15 min idle)

### Step 3: Configure Environment Variables

In your Render dashboard, set these environment variables:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |

**Important:** The service role key bypasses Row Level Security. Never expose it to clients.

## Integration notes (where existing code plugs in)

- **Battleship:** implement the `Game` interface in `client/src/lib/registries/gameRegistry.ts`, drop the module under `client/src/components/games/modules/battleship/`, and register it. The `GameMenu` will render its card automatically.
- **Animations (existing reward effects):** the reward system dispatches an `EffectPayload` via `effectRegistry.trigger(effectId, context)`. Drop each existing animation component behind one registered effect id.
- **Music / audio reactive:** `client/src/lib/registries/audioAdapter.ts` currently runs a `SimulatedBeat` provider. Implement the `AudioProvider` interface (`start`, `stop`, `onFrame(beat)`) with a real source (Spotify SDK, mic input, etc.) and swap the default provider.
- **Persistence:** All data is persisted in Supabase (rooms, notes, points, games, rewards, locations). No data is lost on server restarts.
