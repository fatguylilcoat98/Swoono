import { useState } from "react";
import { useRoomStore } from "../../../../state/roomStore";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";
import { getSocket } from "../../../../lib/socket";

export default function DailyDareChainGame({
  onExit,
}: GameContextProps) {
  const [newDareText, setNewDareText] = useState("");

  // Use Socket.IO pattern like existing games
  const activeGame = useRoomStore((s) => s.activeGame);
  const clientId = useRoomStore((s) => s.clientId);
  const game = activeGame && (activeGame as any).gameId === "daily-dare-chain" ? activeGame as any : null;
  const socket = getSocket();

  if (!game) {
    return (
      <div className="flex-1 flex items-center justify-center text-swoono-dim">
        Waiting for game to start…
      </div>
    );
  }

  if (game.status === "waiting") {
    return (
      <div className="flex-1 flex flex-col bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-red-900/20">
        <div className="flex items-center justify-between mb-6 px-5 pt-5">
          <div>
            <h2 className="font-display text-2xl text-swoono-ink">Daily Dare Chain</h2>
            <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
              Build your intimacy streak
            </p>
          </div>
          <button
            onClick={onExit}
            className="text-swoono-dim text-xs uppercase tracking-widest hover:text-swoono-accent transition-colors"
          >
            Exit
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center mb-8">
            <h3 className="text-2xl text-swoono-ink mb-4">Dare Each Other</h3>
            <p className="text-swoono-dim mb-6">Take turns sending dares and completing them</p>
            <div className="text-swoono-dim text-sm">
              Waiting for both players to join...
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sendDare = () => {
    if (!newDareText.trim()) return;

    socket.emit("game:move", {
      type: "send_dare",
      text: newDareText.trim()
    });

    setNewDareText("");
  };

  const completeDare = () => {
    socket.emit("game:move", { type: "complete_dare" });
  };

  const skipDare = () => {
    socket.emit("game:move", { type: "skip_dare" });
  };

  const completedDares = game.dares?.filter((d: any) => d.status === "completed") || [];

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-red-900/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-5 pt-5">
        <div>
          <h2 className="font-display text-2xl text-swoono-ink">Daily Dare Chain</h2>
          <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
            {completedDares.length} dares completed
          </p>
        </div>
        <button
          onClick={onExit}
          className="text-swoono-dim text-xs uppercase tracking-widest hover:text-swoono-accent transition-colors"
        >
          Exit
        </button>
      </div>

      {/* Chain Stats */}
      <div className="px-5 mb-6">
        <div className="bg-black/40 rounded-xl p-6 border border-white/10">
          <div className="flex justify-center items-center gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-swoono-accent mb-1">
                🔗 {completedDares.length}
              </div>
              <div className="text-swoono-dim text-xs uppercase tracking-widest">
                Chain Length
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-swoono-ink mb-1">
                {game.dares.length}
              </div>
              <div className="text-swoono-dim text-xs uppercase tracking-widest">
                Total Dares
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 pb-8">
        {!game.currentDare ? (
          /* Send New Dare */
          <div className="max-w-md mx-auto">
            <h3 className="text-xl text-swoono-ink text-center mb-6">Send a Dare</h3>

            <div className="space-y-4">
              <textarea
                value={newDareText}
                onChange={(e) => setNewDareText(e.target.value)}
                placeholder="What's your dare for your partner?"
                maxLength={200}
                className="w-full p-4 bg-white/10 border border-white/20 rounded-lg text-swoono-ink placeholder-swoono-dim/60 focus:outline-none focus:border-swoono-accent/50 resize-none"
                rows={4}
              />
              <div className="text-xs text-swoono-dim/60">
                {newDareText.length}/200 characters
              </div>
              <button
                onClick={sendDare}
                disabled={!newDareText.trim()}
                className="w-full p-4 bg-swoono-accent text-black font-semibold rounded-lg hover:bg-swoono-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send Dare
              </button>
            </div>
          </div>
        ) : (
          /* Current Dare */
          <div className="max-w-md mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl text-swoono-ink mb-2">
                {game.currentDare.author === clientId ? "Your Dare is Out There" : "Dare for You"}
              </h3>
            </div>

            {/* Dare Card */}
            <div className="bg-black/40 rounded-xl p-6 border border-white/10 mb-6">
              <p className="text-swoono-ink text-lg leading-relaxed text-center">
                "{game.currentDare.text}"
              </p>
              <div className="text-center mt-4 text-swoono-dim text-sm">
                — {game.currentDare.author === clientId ? "You" : "Your Partner"}
              </div>
            </div>

            {game.currentDare.author !== clientId ? (
              /* Response Options */
              <div className="flex gap-3">
                <button
                  onClick={completeDare}
                  className="flex-1 p-4 bg-green-500/20 text-green-400 border border-green-400/40 rounded-lg hover:bg-green-500/30 transition-colors font-semibold"
                >
                  ✅ Complete Dare
                </button>
                <button
                  onClick={skipDare}
                  className="flex-1 p-4 bg-red-500/20 text-red-400 border border-red-400/40 rounded-lg hover:bg-red-500/30 transition-colors font-semibold"
                >
                  ❌ Skip Dare
                </button>
              </div>
            ) : (
              /* Waiting State */
              <div className="text-center py-8">
                <div className="text-4xl mb-4">⏳</div>
                <p className="text-swoono-dim">Waiting for your partner to respond...</p>
              </div>
            )}
          </div>
        )}

        {/* Dare History */}
        {game.dares.length > 0 && (
          <div className="mt-8 max-w-md mx-auto">
            <h4 className="text-sm uppercase tracking-widest text-swoono-dim mb-3">Recent Dares</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {game.dares?.slice(-3).reverse().map((dare: any, index: number) => (
                <div key={index} className="bg-black/20 rounded-lg p-3 border border-white/10">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-swoono-ink text-sm">"{dare.text}"</p>
                    <span className={`text-xs px-2 py-1 rounded ${
                      dare.status === "completed"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}>
                      {dare.status}
                    </span>
                  </div>
                  <p className="text-swoono-dim text-xs">
                    by {dare.author === clientId ? "You" : "Partner"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}