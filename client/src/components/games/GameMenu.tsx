import { useState, useEffect } from "react";
import GlassPanel from "../ui/GlassPanel";
import {
  getGamesByCategory,
  type GameCategory,
  type GameDefinition,
} from "../../lib/registries/gameRegistry";
import { useRoomStore } from "../../state/roomStore";
import { useMusicStore } from "../../state/musicStore";
import { getPlaylist } from "../../lib/music/musicTracks";
import DailyPrompt from "./DailyPrompt";
import { isAdmin } from "../../lib/admin";
import UpgradeModal from "../tiers/UpgradeModal";

const TABS: { id: GameCategory; label: string }[] = [
  { id: "arcade", label: "Arcade" },
  { id: "couples", label: "Couples" },
];

export default function GameMenu() {
  const [activeTab, setActiveTab] = useState<GameCategory>("arcade");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const games = getGamesByCategory(activeTab);
  const startGame = useRoomStore((s) => s.startGame);
  const activeGame = useRoomStore((s) => s.activeGame);
  const gameInProgress = activeGame !== null;
  const roomCode = useRoomStore((s) => s.code);
  const clientId = useRoomStore((s) => s.clientId);
  const setPlaylist = useMusicStore((s) => s.setPlaylist);

  // Context-aware music switching based on active tab
  useEffect(() => {
    const musicContext = activeTab === "arcade" ? "guy" :
                        activeTab === "couples" ? "girl" : "neutral";
    const playlist = getPlaylist(musicContext);
    setPlaylist(playlist);
  }, [activeTab, setPlaylist]);

  return (
    <GlassPanel className="p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-display text-lg text-swoono-ink">Games</h2>
        <span className="text-swoono-dim text-[10px] uppercase tracking-widest">
          {gameInProgress ? "In play" : `${games.length} in tab`}
        </span>
      </div>

      <div className="flex gap-1 mb-3 bg-white/5 rounded-full p-1 border border-white/10">
        {TABS.map((t) => {
          const active = t.id === activeTab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest transition-colors ${
                active
                  ? "bg-swoono-accent/25 text-swoono-ink"
                  : "text-swoono-dim hover:text-swoono-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Daily Prompt - Top of Couples Tab */}
      {activeTab === "couples" && roomCode && (
        <DailyPrompt roomCode={roomCode} selfClientId={clientId} />
      )}

      <div className="grid grid-cols-2 gap-2">
        {games.map((g) => (
          <GameCard
            key={g.id}
            game={g}
            disabled={gameInProgress}
            onPlay={() => startGame(g.id)}
            onUpgrade={() => setShowUpgradeModal(true)}
          />
        ))}
      </div>

      <p className="mt-3 text-[10px] text-swoono-dim/70">
        Game modules plug into{" "}
        <code className="text-swoono-dim">gameRegistry</code>.
      </p>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </GlassPanel>
  );
}

function GameCard({
  game,
  disabled,
  onPlay,
  onUpgrade,
}: {
  game: GameDefinition;
  disabled: boolean;
  onPlay: () => void;
  onUpgrade: () => void;
}) {
  // ADMIN ACCESS — bypasses all paywalls for authorized users
  const adminAccess = isAdmin();
  const locked = game.tier > 0 && !adminAccess;
  const available = game.status === "ready" && !locked && !disabled;
  const clickHandler = () => {
    if (available) {
      onPlay();
    } else if (locked && game.status === "ready" && !disabled) {
      onUpgrade();
    }
  };

  return (
    <button
      type="button"
      onClick={clickHandler}
      title={game.description}
      className={`text-left rounded-xl p-3 border transition-all ${
        available
          ? "bg-white/5 border-white/10 hover:bg-white/10 hover:border-swoono-accent/40"
          : locked && game.status === "ready" && !disabled
            ? "bg-white/5 border-amber-500/20 hover:bg-white/10 hover:border-amber-500/40 cursor-pointer"
            : "bg-white/[0.02] border-white/5 cursor-not-allowed opacity-70"
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="text-2xl leading-none">{game.emoji}</div>
        {game.tier === 0 || adminAccess ? (
          <span className="bg-green-500/20 text-green-400 text-[9px] uppercase tracking-wider font-semibold px-2 py-1 rounded">
            {adminAccess && game.tier > 0 ? "ADMIN" : "FREE"}
          </span>
        ) : (
          <span className="bg-amber-500/20 text-amber-400 text-[9px] uppercase tracking-wider font-semibold px-2 py-1 rounded flex items-center gap-1">
            🔒 PRO
          </span>
        )}
      </div>
      <div className="text-sm text-swoono-ink leading-tight">{game.name}</div>
      <div className="mt-1">
        <span className="text-[9px] uppercase tracking-wider text-swoono-dim/70">
          {game.status === "ready" ? "Playable" : "Soon"}
        </span>
      </div>
    </button>
  );
}
