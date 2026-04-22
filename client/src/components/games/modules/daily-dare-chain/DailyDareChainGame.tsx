import { useEffect, useState } from "react";
import { useGameSession } from "../../../../hooks/useGameSession";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";

type DareTier = 'easy' | 'medium' | 'spicy';

type CurrentDare = {
  text: string;
  tier: DareTier;
  sent_by: string;
  sent_at: string;
  response: string | null;
  responded_at: string | null;
};

type DailyDareState = {
  chain_count: number;
  streak_days: number;
  current_dare: CurrentDare | null;
  dare_history: CurrentDare[];
  skip_count_p1: number;
  skip_count_p2: number;
  last_completed: string | null;
  is_premium: boolean;
};

const EASY_DARES = [
  "Share your go-to comfort food",
  "What's your favorite childhood memory?",
  "Tell me about your perfect Saturday morning",
  "What song always makes you happy?",
  "What's something you're grateful for today?"
];

const MEDIUM_DARES = [
  "What habit of mine secretly annoys you?",
  "What's something you've been putting off telling me?",
  "What do you think our biggest challenge as a couple is?",
  "What's one thing you'd change about our relationship?",
  "What's your biggest fear about our future together?"
];

const SPICY_DARES = [
  "What's something you've never told me?",
  "What's your biggest fantasy about us?",
  "What's something you wish we did more often?",
  "What's the sexiest thing about me?",
  "What's something new you'd like to try together?"
];

export default function DailyDareChainGame({
  roomCode,
  selfClientId,
  onExit,
}: GameContextProps) {
  const { gameState, updateGameState, createSession } = useGameSession(roomCode);
  const [selectedTier, setSelectedTier] = useState<DareTier>('easy');
  const [customDare, setCustomDare] = useState("");
  const [response, setResponse] = useState("");

  // Initialize game session
  useEffect(() => {
    if (!gameState) {
      createSession('daily-dare-chain', selfClientId);
    }
  }, [gameState, createSession, selfClientId]);

  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center text-swoono-dim">
        Loading Daily Dare Chain…
      </div>
    );
  }

  const state = gameState.game_state as DailyDareState;
  // TESTER MODE — bypasses all paywalls
  const TESTER_MODE = import.meta.env.VITE_TESTER_MODE === 'true';
  const isPremium = state.is_premium || TESTER_MODE;

  const sendDare = async (tier: DareTier, dareText?: string) => {
    const dares = tier === 'easy' ? EASY_DARES : tier === 'medium' ? MEDIUM_DARES : SPICY_DARES;
    const text = dareText || dares[Math.floor(Math.random() * dares.length)];

    const newDare: CurrentDare = {
      text,
      tier,
      sent_by: selfClientId,
      sent_at: new Date().toISOString(),
      response: null,
      responded_at: null
    };

    await updateGameState({
      ...state,
      current_dare: newDare
    });

    setCustomDare("");
  };

  const respondToDare = async () => {
    if (!state.current_dare || !response.trim()) return;

    const updatedDare: CurrentDare = {
      ...state.current_dare,
      response: response.trim(),
      responded_at: new Date().toISOString()
    };

    await updateGameState({
      ...state,
      current_dare: null,
      dare_history: [...state.dare_history, updatedDare],
      chain_count: state.chain_count + 1,
      streak_days: state.streak_days + 1
    });

    setResponse("");
  };

  const skipDare = async () => {
    if (!state.current_dare) return;

    const isMySkip = state.current_dare.sent_by !== selfClientId;
    const newSkipCount = isMySkip ?
      { skip_count_p1: state.current_dare.sent_by === selfClientId ? state.skip_count_p1 : state.skip_count_p1 + 1,
        skip_count_p2: state.current_dare.sent_by !== selfClientId ? state.skip_count_p2 : state.skip_count_p2 + 1 } :
      { skip_count_p1: state.skip_count_p1, skip_count_p2: state.skip_count_p2 };

    const chainBroken = newSkipCount.skip_count_p1 >= 3 || newSkipCount.skip_count_p2 >= 3;

    await updateGameState({
      ...state,
      current_dare: null,
      ...newSkipCount,
      chain_count: chainBroken ? 0 : state.chain_count,
      streak_days: chainBroken ? 0 : state.streak_days
    });
  };

  const getTierColor = (tier: DareTier) => {
    switch (tier) {
      case 'easy': return 'text-green-400 border-green-400 bg-green-400/10';
      case 'medium': return 'text-orange-400 border-orange-400 bg-orange-400/10';
      case 'spicy': return 'text-red-400 border-red-400 bg-red-400/10';
    }
  };

  const canAccessTier = (tier: DareTier) => {
    if (tier === 'easy') return true;
    return isPremium;
  };

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-red-900/20">
      {/* Header */}
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

      {/* Chain Stats */}
      <div className="px-5 mb-6">
        <div className="bg-black/40 rounded-xl p-6 border border-white/10">
          <div className="flex justify-center items-center gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-swoono-accent mb-1">
                🔥 {state.streak_days || 0}
              </div>
              <div className="text-swoono-dim text-xs uppercase tracking-widest">
                Day Streak
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-swoono-ink mb-1">
                {state.chain_count || 0}
              </div>
              <div className="text-swoono-dim text-xs uppercase tracking-widest">
                Chain Count
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg text-swoono-dim">
                {Math.max(0, 3 - (state.skip_count_p1 || 0))} / {Math.max(0, 3 - (state.skip_count_p2 || 0))}
              </div>
              <div className="text-swoono-dim text-xs uppercase tracking-widest">
                Skips Left
              </div>
            </div>
          </div>

          {/* Milestone Badges */}
          <div className="flex justify-center gap-2 mt-4">
            {[7, 14, 30, 60, 90].map((milestone) => (
              <div
                key={milestone}
                className={`px-2 py-1 rounded text-xs ${
                  state.streak_days >= milestone
                    ? 'bg-gold-500/20 text-gold-400 border border-gold-400/30'
                    : 'bg-gray-500/20 text-gray-500 border border-gray-500/30'
                }`}
              >
                {milestone}d
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 pb-8">
        {!state.current_dare ? (
          /* Send Dare */
          <div className="max-w-md mx-auto">
            <h3 className="text-xl text-swoono-ink text-center mb-6">Send a Dare</h3>

            {/* Tier Selection */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {(['easy', 'medium', 'spicy'] as DareTier[]).map((tier) => {
                const accessible = canAccessTier(tier);
                return (
                  <button
                    key={tier}
                    onClick={() => accessible && setSelectedTier(tier)}
                    disabled={!accessible}
                    className={`p-3 rounded-lg border-2 text-sm uppercase tracking-widest font-semibold transition-colors ${
                      selectedTier === tier && accessible
                        ? getTierColor(tier)
                        : accessible
                          ? 'border-white/20 text-swoono-dim hover:border-white/40'
                          : 'border-white/10 text-swoono-dim/40 cursor-not-allowed'
                    }`}
                  >
                    {tier}
                    {!accessible && <div className="text-xs mt-1">🔒</div>}
                  </button>
                );
              })}
            </div>

            {!canAccessTier(selectedTier) && (
              <div className="text-center p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-4">
                <div className="text-amber-400 text-sm mb-2">🔒 Premium Feature</div>
                <div className="text-xs text-swoono-dim">
                  Upgrade to access {selectedTier} dares and custom dare creation
                </div>
              </div>
            )}

            {/* Random Dare Button */}
            <button
              onClick={() => sendDare(selectedTier)}
              disabled={!canAccessTier(selectedTier)}
              className={`w-full p-4 rounded-lg border-2 font-semibold mb-4 transition-colors ${
                canAccessTier(selectedTier)
                  ? `${getTierColor(selectedTier)} hover:bg-opacity-20`
                  : 'border-white/10 text-swoono-dim/40 cursor-not-allowed bg-white/5'
              }`}
            >
              Send Random {selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)} Dare
            </button>

            {/* Custom Dare (Premium) */}
            {isPremium && (
              <div className="space-y-3">
                <textarea
                  value={customDare}
                  onChange={(e) => setCustomDare(e.target.value)}
                  placeholder="Write a custom dare..."
                  maxLength={200}
                  className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-swoono-ink placeholder-swoono-dim/60 focus:outline-none focus:border-swoono-accent/50 resize-none"
                  rows={3}
                />
                <button
                  onClick={() => sendDare(selectedTier, customDare)}
                  disabled={!customDare.trim()}
                  className="w-full p-3 bg-swoono-accent text-black font-semibold rounded-lg hover:bg-swoono-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Send Custom Dare
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Respond to Dare */
          <div className="max-w-md mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl text-swoono-ink mb-2">
                {state.current_dare.sent_by === selfClientId ? "Waiting for Response" : "Dare for You"}
              </h3>
              <div className={`inline-block px-3 py-1 rounded-full border text-xs uppercase tracking-widest font-semibold ${
                getTierColor(state.current_dare.tier)
              }`}>
                {state.current_dare.tier}
              </div>
            </div>

            {/* Dare Card */}
            <div className="bg-black/40 rounded-xl p-6 border border-white/10 mb-6">
              <p className="text-swoono-ink text-lg leading-relaxed text-center">
                "{state.current_dare.text}"
              </p>
            </div>

            {state.current_dare.sent_by !== selfClientId ? (
              /* Response Form */
              <div className="space-y-4">
                <textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Your response..."
                  maxLength={300}
                  className="w-full p-4 bg-white/10 border border-white/20 rounded-lg text-swoono-ink placeholder-swoono-dim/60 focus:outline-none focus:border-swoono-accent/50 resize-none"
                  rows={4}
                />
                <div className="text-xs text-swoono-dim/60">
                  {response.length}/300 characters
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={respondToDare}
                    disabled={!response.trim()}
                    className="flex-1 p-3 bg-swoono-accent text-black font-semibold rounded-lg hover:bg-swoono-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Complete Dare
                  </button>
                  <button
                    onClick={skipDare}
                    className="px-6 py-3 bg-red-500/20 text-red-400 border border-red-400/40 rounded-lg hover:bg-red-500/30 transition-colors"
                  >
                    Skip
                  </button>
                </div>
              </div>
            ) : (
              /* Waiting State */
              <div className="text-center py-8">
                <div className="text-4xl mb-4">⏳</div>
                <p className="text-swoono-dim">Waiting for your partner's response...</p>
              </div>
            )}
          </div>
        )}

        {/* History Preview */}
        {state.dare_history.length > 0 && (
          <div className="mt-8 max-w-md mx-auto">
            <h4 className="text-sm uppercase tracking-widest text-swoono-dim mb-3">Recent History</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {state.dare_history.slice(-3).map((dare, index) => (
                <div key={index} className="bg-black/20 rounded-lg p-3 border border-white/10">
                  <div className={`text-xs uppercase font-semibold ${getTierColor(dare.tier)} mb-1`}>
                    {dare.tier}
                  </div>
                  <p className="text-swoono-ink text-sm mb-2">"{dare.text}"</p>
                  <p className="text-swoono-dim text-xs">"{dare.response}"</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}