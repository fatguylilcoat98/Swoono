import { useState } from "react";
import { useRoomStore } from "../../../../state/roomStore";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";
import { getSocket } from "../../../../lib/socket";

const PACKAGE_TYPES = [
  { id: "encouragement", label: "Encouragement", emoji: "💪", color: "green" },
  { id: "love", label: "Love Note", emoji: "❤️", color: "red" },
  { id: "support", label: "Support", emoji: "🤗", color: "blue" },
  { id: "surprise", label: "Surprise", emoji: "🎁", color: "purple" }
];

export default function CarePackageGame({
  onExit,
}: GameContextProps) {
  const [message, setMessage] = useState("");
  const [selectedType, setSelectedType] = useState("encouragement");
  const [showComposer, setShowComposer] = useState(false);

  // Use Socket.IO pattern like existing games
  const activeGame = useRoomStore((s) => s.activeGame);
  const clientId = useRoomStore((s) => s.clientId);
  const game = activeGame && (activeGame as any).gameId === "care-package" ? activeGame as any : null;
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
      <div className="flex-1 flex flex-col bg-gradient-to-br from-pink-900/20 via-rose-900/20 to-red-900/20">
        <div className="flex items-center justify-between mb-6 px-5 pt-5">
          <div>
            <h2 className="font-display text-2xl text-swoono-ink">Care Package</h2>
            <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
              Send love when it's needed most
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
            <h3 className="text-2xl text-swoono-ink mb-4">Send Care</h3>
            <p className="text-swoono-dim mb-6">One player sends a care package, the other opens it</p>
            <div className="text-swoono-dim text-sm">
              Waiting for both players to join...
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sendPackage = () => {
    if (!message.trim()) return;

    socket.emit("game:move", {
      type: "send_package",
      message: message.trim(),
      packageType: selectedType
    });

    setMessage("");
    setShowComposer(false);
  };

  const openPackage = () => {
    socket.emit("game:move", { type: "open_package" });
  };

  const getTypeInfo = (type: string) => {
    return PACKAGE_TYPES.find(t => t.id === type) || PACKAGE_TYPES[0];
  };

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-pink-900/20 via-rose-900/20 to-red-900/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-5 pt-5">
        <div>
          <h2 className="font-display text-2xl text-swoono-ink">Care Package</h2>
          <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
            Send love when it's needed most
          </p>
        </div>
        <button
          onClick={onExit}
          className="text-swoono-dim text-xs uppercase tracking-widest hover:text-swoono-accent transition-colors"
        >
          Exit
        </button>
      </div>

      <div className="flex-1 px-5 pb-8">
        {showComposer ? (
          /* Package Composer */
          <div className="max-w-md mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl text-swoono-ink mb-2">Create Care Package</h3>
              <p className="text-swoono-dim">Send encouragement for when they need it most</p>
            </div>

            {/* Package Type Selection */}
            <div className="bg-black/40 rounded-xl p-6 border border-white/10 mb-6">
              <label className="block text-swoono-ink text-sm mb-3">Package Type</label>
              <div className="grid grid-cols-2 gap-3">
                {PACKAGE_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      selectedType === type.id
                        ? 'border-swoono-accent bg-swoono-accent/20 text-swoono-ink'
                        : 'border-white/20 hover:border-white/40 text-swoono-dim hover:text-swoono-ink'
                    }`}
                  >
                    <div className="text-2xl mb-1">{type.emoji}</div>
                    <div className="text-sm font-medium">{type.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div className="bg-black/40 rounded-xl p-6 border border-white/10 mb-6">
              <label className="block text-swoono-ink text-sm mb-3">Your Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="You've got this! Remember how amazing you are..."
                maxLength={200}
                className="w-full p-4 bg-white/10 border border-white/20 rounded-lg text-swoono-ink placeholder-swoono-dim/60 focus:outline-none focus:border-swoono-accent/50 resize-none"
                rows={4}
              />
              <div className="text-xs text-swoono-dim/60 mt-2">
                {message.length}/200 characters
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowComposer(false)}
                className="flex-1 p-3 bg-white/10 border border-white/20 text-swoono-dim rounded-lg hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendPackage}
                disabled={!message.trim()}
                className="flex-1 p-3 bg-swoono-accent text-black font-semibold rounded-lg hover:bg-swoono-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send Package
              </button>
            </div>
          </div>
        ) : !game.package ? (
          /* No Package - Send New */
          <div className="max-w-md mx-auto text-center">
            <div className="text-6xl mb-6">📦</div>
            <h3 className="text-xl text-swoono-ink mb-4">No Care Package</h3>
            <p className="text-swoono-dim mb-8">
              Send your partner a care package with a message of love and support
            </p>

            <button
              onClick={() => setShowComposer(true)}
              className="w-full p-4 bg-swoono-accent text-black font-bold rounded-xl text-lg hover:bg-swoono-accent/80 transition-colors"
            >
              Create Care Package
            </button>
          </div>
        ) : !game.opened ? (
          /* Package Ready to Open */
          <div className="max-w-md mx-auto text-center">
            <div className="text-6xl mb-6">🎁</div>
            <h3 className="text-xl text-swoono-ink mb-4">
              {game.package.sender === clientId ? "Package Sent!" : "Care Package Waiting"}
            </h3>

            {game.package.sender === clientId ? (
              /* Sender View */
              <div className="space-y-4">
                <p className="text-swoono-dim">
                  Your care package is waiting for your partner to open it.
                </p>
                <div className="bg-black/40 rounded-xl p-6 border border-white/10">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <span className="text-2xl">{getTypeInfo(game.package.type).emoji}</span>
                    <span className="text-swoono-accent font-semibold">
                      {getTypeInfo(game.package.type).label}
                    </span>
                  </div>
                  <p className="text-swoono-ink italic">"{game.package.message}"</p>
                </div>
                <p className="text-swoono-dim text-sm">
                  Waiting for them to open it...
                </p>
              </div>
            ) : (
              /* Receiver View */
              <div className="space-y-6">
                <p className="text-swoono-dim">
                  Your partner sent you a care package!
                </p>
                <div className="bg-gradient-to-r from-pink-500/20 to-rose-500/20 border border-pink-400/40 rounded-xl p-8 cursor-pointer hover:from-pink-500/30 hover:to-rose-500/30 transition-all"
                     onClick={openPackage}>
                  <div className="text-4xl mb-4">{getTypeInfo(game.package.type).emoji}</div>
                  <div className="text-swoono-accent font-semibold mb-2">
                    {getTypeInfo(game.package.type).label}
                  </div>
                  <div className="text-swoono-ink font-bold">
                    Tap to Open Package
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Package Opened */
          <div className="max-w-md mx-auto text-center">
            <div className="text-6xl mb-6">💝</div>
            <h3 className="text-xl text-swoono-ink mb-4">Package Opened!</h3>

            <div className="bg-black/40 rounded-xl p-6 border border-white/10 mb-6">
              <div className="flex items-center justify-center gap-3 mb-4">
                <span className="text-3xl">{getTypeInfo(game.package.type).emoji}</span>
                <span className="text-swoono-accent font-bold text-lg">
                  {getTypeInfo(game.package.type).label}
                </span>
              </div>
              <p className="text-swoono-ink text-lg leading-relaxed italic mb-4">
                "{game.package.message}"
              </p>
              <p className="text-swoono-dim text-sm">
                — With love from {game.package.sender === clientId ? "you" : "your partner"}
              </p>
            </div>

            {game.package.sender !== clientId && (
              <div className="space-y-4">
                <p className="text-swoono-dim">
                  How sweet! Your partner was thinking of you.
                </p>
                <button
                  onClick={() => setShowComposer(true)}
                  className="w-full p-4 bg-swoono-accent text-black font-semibold rounded-xl hover:bg-swoono-accent/80 transition-colors"
                >
                  Send One Back
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}