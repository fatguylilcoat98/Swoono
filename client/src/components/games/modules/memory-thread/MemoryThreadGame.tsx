import { useState } from "react";
import { useRoomStore } from "../../../../state/roomStore";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";
import { getSocket } from "../../../../lib/socket";

export default function MemoryThreadGame({
  onExit,
}: GameContextProps) {
  const [newMemoryText, setNewMemoryText] = useState("");

  // Use Socket.IO pattern like existing games
  const activeGame = useRoomStore((s) => s.activeGame);
  const clientId = useRoomStore((s) => s.clientId);
  const game = activeGame && (activeGame as any).gameId === "memory-thread" ? activeGame as any : null;
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
      <div className="flex-1 flex flex-col bg-gradient-to-br from-rose-50/5 via-cream-50/5 to-amber-50/5">
        <div className="flex items-center justify-between mb-6 px-5 pt-5">
          <div>
            <h2 className="font-display text-2xl text-swoono-ink">Memory Thread</h2>
            <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
              Start your story together
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
            <h3 className="text-2xl text-swoono-ink mb-4">Build Your Story</h3>
            <p className="text-swoono-dim mb-6">A shared memory journal for both of you</p>
            <div className="text-swoono-dim text-sm">
              Waiting for both players to join...
            </div>
          </div>
        </div>
      </div>
    );
  }

  const addMemory = () => {
    if (!newMemoryText.trim()) return;

    socket.emit("game:move", {
      type: "add_entry",
      text: newMemoryText.trim()
    });

    setNewMemoryText("");
  };

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-rose-50/5 via-cream-50/5 to-amber-50/5">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-5 pt-5">
        <div>
          <h2 className="font-display text-2xl text-swoono-ink">Memory Thread</h2>
          <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
            {game.entries?.length || 0} memories together
          </p>
        </div>
        <button
          onClick={onExit}
          className="text-swoono-dim text-xs uppercase tracking-widest hover:text-swoono-accent transition-colors"
        >
          Exit
        </button>
      </div>

      {/* Thread Messages */}
      <div className="flex-1 p-5 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          {game.entries.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">💫</div>
              <h3 className="text-lg text-swoono-ink mb-2">Empty Memory Thread</h3>
              <p className="text-swoono-dim">Add your first memory below</p>
            </div>
          ) : (
            <div className="space-y-4">
              {game.entries?.map((entry: any, index: number) => {
                const isMyMessage = entry.author === clientId;
                return (
                  <div
                    key={index}
                    className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-sm p-4 rounded-2xl ${
                        isMyMessage
                          ? 'bg-swoono-accent/20 text-swoono-ink border border-swoono-accent/30'
                          : 'bg-white/10 text-swoono-ink border border-white/20'
                      }`}
                    >
                      <div>
                        <p className="text-sm leading-relaxed">{entry.text}</p>
                        <div className="text-xs text-swoono-dim/70 mt-2">
                          {new Date(entry.timestamp).toLocaleDateString()} - {entry.author === clientId ? 'You' : 'Partner'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Memory Form */}
      <div className="p-5 border-t border-white/10 bg-black/20">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-3">
            {/* Text Input */}
            <input
              type="text"
              value={newMemoryText}
              onChange={(e) => setNewMemoryText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addMemory()}
              placeholder="Add to our story..."
              maxLength={200}
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-swoono-ink placeholder-swoono-dim/60 focus:outline-none focus:border-swoono-accent/50"
            />

            {/* Send Button */}
            <button
              onClick={addMemory}
              disabled={!newMemoryText.trim()}
              className="bg-swoono-accent text-black px-6 py-2 rounded-lg font-semibold hover:bg-swoono-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
          <div className="text-xs text-swoono-dim/60 mt-2">
            {newMemoryText.length}/200 characters
          </div>
        </div>
      </div>
    </div>
  );
}