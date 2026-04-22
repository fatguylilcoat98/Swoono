import { useState } from "react";
import { useRoomStore } from "../../../../state/roomStore";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";
import { getSocket } from "../../../../lib/socket";

export default function FutureForecastGame({
  onExit,
}: GameContextProps) {
  const [predictionText, setPredictionText] = useState("");

  // Use Socket.IO pattern like existing games
  const activeGame = useRoomStore((s) => s.activeGame);
  const clientId = useRoomStore((s) => s.clientId);
  const game = activeGame && (activeGame as any).gameId === "future-forecast" ? activeGame as any : null;
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
      <div className="flex-1 flex flex-col bg-gradient-to-br from-blue-900/20 via-indigo-900/20 to-purple-900/20">
        <div className="flex items-center justify-between mb-6 px-5 pt-5">
          <div>
            <h2 className="font-display text-2xl text-swoono-ink">Future Forecast</h2>
            <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
              Predict the future together
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
            <h3 className="text-2xl text-swoono-ink mb-4">Predict Together</h3>
            <p className="text-swoono-dim mb-6">Both submit predictions, then vote on the most accurate</p>
            <div className="text-swoono-dim text-sm">
              Waiting for both players to join...
            </div>
          </div>
        </div>
      </div>
    );
  }

  const submitPrediction = () => {
    if (!predictionText.trim()) return;

    socket.emit("game:move", {
      type: "submit_prediction",
      text: predictionText.trim()
    });

    setPredictionText("");
  };

  const vote = (votedFor: string) => {
    socket.emit("game:move", { type: "vote", votedFor });
  };

  const myPrediction = game.predictions?.[clientId];
  const allPredictions = Object.entries(game.predictions || {});
  const allVotes = Object.entries(game.votes || {});
  const bothSubmitted = allPredictions.length === 2;
  const bothVoted = allVotes.length === 2;

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-blue-900/20 via-indigo-900/20 to-purple-900/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-5 pt-5">
        <div>
          <h2 className="font-display text-2xl text-swoono-ink">Future Forecast</h2>
          <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
            Round {game.revealed && bothVoted ? "Complete" : "In Progress"}
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
        {/* Question */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-black/40 rounded-xl p-6 border border-white/10 text-center">
            <div className="text-4xl mb-4">🔮</div>
            <h3 className="text-xl text-swoono-ink mb-2">Today's Question</h3>
            <p className="text-lg text-swoono-accent leading-relaxed">
              "{game.question || 'Loading question...'}"
            </p>
          </div>
        </div>

        {!myPrediction ? (
          /* Submit Prediction */
          <div className="max-w-md mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl text-swoono-ink mb-2">Your Prediction</h3>
              <p className="text-swoono-dim">What's your forecast?</p>
            </div>

            <div className="space-y-4">
              <textarea
                value={predictionText}
                onChange={(e) => setPredictionText(e.target.value)}
                placeholder="Share your prediction..."
                maxLength={150}
                className="w-full p-4 bg-white/10 border border-white/20 rounded-lg text-swoono-ink placeholder-swoono-dim/60 focus:outline-none focus:border-swoono-accent/50 resize-none"
                rows={4}
              />
              <div className="text-xs text-swoono-dim/60">
                {predictionText.length}/150 characters
              </div>
              <button
                onClick={submitPrediction}
                disabled={!predictionText.trim()}
                className="w-full p-4 bg-swoono-accent text-black font-semibold rounded-lg hover:bg-swoono-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Submit Prediction
              </button>
            </div>
          </div>
        ) : !bothSubmitted ? (
          /* Waiting for Partner */
          <div className="max-w-md mx-auto text-center">
            <div className="text-6xl mb-6">⏳</div>
            <h3 className="text-xl text-swoono-ink mb-4">Prediction Submitted!</h3>
            <p className="text-swoono-dim mb-6">
              Waiting for your partner's prediction...
            </p>
            <div className="bg-black/40 rounded-xl p-6 border border-white/10">
              <h4 className="text-swoono-ink mb-3">Your Prediction:</h4>
              <p className="text-swoono-dim text-sm italic">"{myPrediction}"</p>
            </div>
          </div>
        ) : !game.revealed ? (
          /* Both Submitted - Show Reveal Button */
          <div className="max-w-md mx-auto text-center">
            <div className="text-6xl mb-6">🎭</div>
            <h3 className="text-xl text-swoono-ink mb-4">Both Predictions Are In!</h3>
            <p className="text-swoono-dim mb-6">
              Ready to see what you both predicted?
            </p>
            <button
              onClick={() => socket.emit("game:move", { type: "reveal" })}
              className="px-8 py-4 bg-swoono-accent text-black font-bold rounded-xl text-lg hover:bg-swoono-accent/80 transition-colors"
            >
              Reveal Predictions
            </button>
          </div>
        ) : !game.votes[clientId] ? (
          /* Vote Phase */
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl text-swoono-ink mb-2">The Predictions Are Revealed!</h3>
              <p className="text-swoono-dim">Vote for the most accurate prediction</p>
            </div>

            <div className="space-y-4 mb-6">
              {allPredictions.map(([playerId, prediction]) => (
                <div key={playerId} className="bg-black/40 rounded-xl p-6 border border-white/10">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="text-swoono-accent font-semibold">
                      {playerId === clientId ? "Your Prediction" : "Partner's Prediction"}
                    </h4>
                  </div>
                  <p className="text-swoono-ink leading-relaxed mb-4">
                    "{String(prediction)}"
                  </p>
                  <button
                    onClick={() => vote(playerId)}
                    className="w-full p-3 bg-green-500/20 text-green-400 border border-green-400/40 rounded-lg hover:bg-green-500/30 transition-colors font-semibold"
                  >
                    Vote: Most Accurate
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : !bothVoted ? (
          /* Waiting for Partner Vote */
          <div className="max-w-md mx-auto text-center">
            <div className="text-6xl mb-6">🗳️</div>
            <h3 className="text-xl text-swoono-ink mb-4">Vote Cast!</h3>
            <p className="text-swoono-dim">
              Waiting for your partner to vote...
            </p>
          </div>
        ) : (
          /* Results */
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl text-swoono-ink mb-2">Results Are In!</h3>
            </div>

            <div className="space-y-4 mb-8">
              {allPredictions.map(([playerId, prediction]) => {
                const votes = allVotes.filter(([_, votedFor]) => votedFor === playerId).length;
                const isWinner = votes > allVotes.length / 2;

                return (
                  <div key={playerId} className={`rounded-xl p-6 border ${
                    isWinner
                      ? "bg-green-500/20 border-green-400/40"
                      : "bg-black/40 border-white/10"
                  }`}>
                    <div className="flex justify-between items-start mb-3">
                      <h4 className={`font-semibold ${
                        isWinner ? "text-green-400" : "text-swoono-accent"
                      }`}>
                        {playerId === clientId ? "Your Prediction" : "Partner's Prediction"}
                        {isWinner && " 👑"}
                      </h4>
                      <span className="text-swoono-dim text-sm">
                        {votes} votes
                      </span>
                    </div>
                    <p className="text-swoono-ink leading-relaxed">
                      "{String(prediction)}"
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="text-center">
              <p className="text-swoono-dim mb-6">
                Great predictions! Ready for another round?
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}