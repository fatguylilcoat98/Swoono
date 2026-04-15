import { motion } from "framer-motion";
import { useRoomStore } from "../../state/roomStore";
import { usePointsStore } from "../../state/pointsStore";
import { useThemeStore } from "../../state/themeStore";
import ParticleField from "../particles/ParticleField";
import NoteBoard from "../notes/NoteBoard";
import NoteComposer from "../notes/NoteComposer";
import GameMenu from "../games/GameMenu";
import RewardsPanel from "../rewards/RewardsPanel";
import LeaderboardPanel from "../leaderboard/LeaderboardPanel";
import TiersPanel from "../tiers/TiersPanel";
import GlassPanel from "../ui/GlassPanel";
import ModeSwitcher from "../theme/ModeSwitcher";
import DistanceBadge from "../distance/DistanceBadge";
import MusicPlayer from "../audio/MusicPlayer";
import { getGame } from "../../lib/registries/gameRegistry";

type RoomShellProps = {
  onLeave: () => void;
};

export default function RoomShell({ onLeave }: RoomShellProps) {
  const code = useRoomStore((s) => s.code);
  const peers = useRoomStore((s) => s.peers);
  const clientId = useRoomStore((s) => s.clientId);
  const activeGame = useRoomStore((s) => s.activeGame);
  const exitGame = useRoomStore((s) => s.exitGame);
  const points = usePointsStore((s) => s.points);
  const awardPoints = usePointsStore((s) => s.award);
  const theme = useThemeStore((s) => s.theme);

  const me = peers.find((p) => p.clientId === clientId);
  const partner = peers.find((p) => p.clientId !== clientId);

  const activeGameDef = activeGame ? getGame(activeGame.gameId) : null;
  const ActiveGameComponent = activeGameDef?.component ?? null;

  return (
    <motion.div
      className="relative min-h-dvh"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: theme.motion.durationSlow, ease: theme.motion.easing }}
    >
      <ParticleField
        className="fixed inset-0 z-0"
        density={theme.motion.particleDensity}
        speed={theme.motion.particleSpeed}
        pulseStrength={theme.motion.particlePulseStrength}
        hueStart={theme.motion.particleHueStart}
        hueSpread={theme.motion.particleHueSpread}
        drag={theme.motion.particleDrag}
      />

      <div className="relative z-10 min-h-dvh flex flex-col">
        <header className="px-5 md:px-8 pt-5 pb-3">
          <GlassPanel className="px-5 py-3 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="font-display text-xl text-swoono-ink">
                Swoon<span className="text-swoono-accent">♥</span>
              </span>
              <span className="hidden md:inline-block text-swoono-dim text-xs uppercase tracking-widest">
                Room
              </span>
              <span className="font-mono text-swoono-ink tracking-widest bg-white/5 px-2 py-1 rounded text-sm">
                {code}
              </span>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <PresenceDots me={me?.name} partner={partner?.name} />
              <DistanceBadge />
              <MusicPlayer />
              <div className="text-swoono-dim text-xs uppercase tracking-widest hidden sm:block">
                <span className="text-swoono-ink text-base font-medium mr-1">
                  {points}
                </span>
                pts
              </div>
              <ModeSwitcher />
              <button
                onClick={onLeave}
                className="text-swoono-dim text-xs uppercase tracking-widest hover:text-swoono-accent transition-colors"
              >
                Leave
              </button>
            </div>
          </GlassPanel>
        </header>

        <main className="flex-1 px-5 md:px-8 pb-8 grid gap-5 md:grid-cols-3 md:auto-rows-min">
          <section className="md:col-span-2 flex flex-col gap-4 min-h-0">
            {ActiveGameComponent && activeGame ? (
              <GlassPanel className="p-5 md:p-6 flex flex-col min-h-[480px]">
                <ActiveGameComponent
                  roomCode={code ?? ""}
                  selfClientId={clientId}
                  onExit={exitGame}
                  onAwardPoints={awardPoints}
                />
              </GlassPanel>
            ) : (
              <>
                <GlassPanel className="p-5 md:p-6 flex flex-col min-h-[360px]">
                  <div className="flex items-baseline justify-between mb-4">
                    <h2 className="font-display text-xl text-swoono-ink">
                      Notes
                    </h2>
                    <span className="text-swoono-dim text-xs uppercase tracking-widest">
                      Live board
                    </span>
                  </div>
                  {partner ? (
                    <NoteBoard />
                  ) : (
                    <WaitingForPartner code={code ?? ""} />
                  )}
                </GlassPanel>
                <GlassPanel className="p-4 md:p-5">
                  <NoteComposer />
                </GlassPanel>
              </>
            )}
          </section>

          <aside className="flex flex-col gap-5">
            <GameMenu />
            <RewardsPanel />
            <LeaderboardPanel />
            <TiersPanel />
          </aside>
        </main>
      </div>
    </motion.div>
  );
}

function PresenceDots({ me, partner }: { me?: string; partner?: string }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="flex items-center gap-2 text-swoono-dim">
        <span className="w-2 h-2 rounded-full bg-swoono-accent shadow-[0_0_8px_rgba(255,77,143,0.8)]" />
        <span className="text-swoono-ink">{me ?? "You"}</span>
      </span>
      <span className="flex items-center gap-2 text-swoono-dim">
        <span
          className={`w-2 h-2 rounded-full ${
            partner
              ? "bg-swoono-accent2 shadow-[0_0_8px_rgba(184,69,255,0.8)]"
              : "bg-white/15"
          }`}
        />
        <span className={partner ? "text-swoono-ink" : "text-swoono-dim/60"}>
          {partner ?? "Waiting…"}
        </span>
      </span>
    </div>
  );
}

function WaitingForPartner({ code }: { code: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
      <motion.div
        className="w-16 h-16 rounded-full bg-swoono-accent/15 mb-5 flex items-center justify-center shadow-glow"
        animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="text-3xl">💌</span>
      </motion.div>
      <p className="text-swoono-ink text-lg mb-2">Waiting for your person…</p>
      <p className="text-swoono-dim text-sm max-w-xs">
        Share the code{" "}
        <span className="font-mono text-swoono-accent tracking-widest">
          {code}
        </span>{" "}
        so they can join.
      </p>
    </div>
  );
}
