import { useEffect, useState } from "react";
import { useGameSession } from "../../../../hooks/useGameSession";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";

type Prediction = {
  question: string;
  answer: string;
};

type FutureForecastState = {
  current_week: string;
  p1_predictions: Prediction[];
  p2_predictions: Prediction[];
  p1_results: Prediction[];
  p2_results: Prediction[];
  p1_accuracy_total: number;
  p2_accuracy_total: number;
  weeks_played: number;
  status: 'submitting' | 'waiting' | 'revealing' | 'scoring';
  player1_id: string;
  player2_id: string;
};

const PREDICTION_TEMPLATES = [
  "Will [partner] work late this week?",
  "What will [partner] want for dinner Friday?",
  "Will [partner] feel stressed this week?",
  "What will [partner] be excited about?",
  "Will [partner] stay up past midnight?",
  "What mood will [partner] be in Sunday?",
  "Will [partner] exercise this week?",
  "What will [partner] complain about?",
  "Will [partner] want to go out or stay in?",
  "What will make [partner] laugh this week?",
  "Will [partner] buy something unexpected?",
  "What will [partner] be craving?",
];

export default function FutureForecastGame({
  roomCode,
  selfClientId,
  onExit,
}: GameContextProps) {
  const { gameState, updateGameState, createSession } = useGameSession(roomCode);
  const [predictions, setPredictions] = useState<Prediction[]>([
    { question: "", answer: "" },
    { question: "", answer: "" },
    { question: "", answer: "" }
  ]);

  // Initialize game session
  useEffect(() => {
    if (!gameState) {
      createSession('future-forecast', selfClientId);
    }
  }, [gameState, createSession, selfClientId]);

  const getWeekString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const week = Math.ceil((now.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    return `${year}-W${week}`;
  };

  const generateQuestions = () => {
    const shuffled = [...PREDICTION_TEMPLATES].sort(() => Math.random() - 0.5);
    const newPredictions = shuffled.slice(0, 3).map(template => ({
      question: template.replace('[partner]', 'your partner'),
      answer: ""
    }));
    setPredictions(newPredictions);
  };

  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center text-swoono-dim">
        Loading Future Forecast…
      </div>
    );
  }

  const state = gameState.game_state as FutureForecastState;
  const isPlayer1 = selfClientId === state.player1_id;
  const hasSubmitted = isPlayer1 ? state.p1_predictions.length > 0 : state.p2_predictions.length > 0;
  const bothSubmitted = state.p1_predictions.length > 0 && state.p2_predictions.length > 0;

  const submitPredictions = async () => {
    const validPredictions = predictions.filter(p => p.question.trim() && p.answer.trim());
    if (validPredictions.length < 3) return;

    const updates = isPlayer1
      ? { p1_predictions: validPredictions }
      : { p2_predictions: validPredictions };

    await updateGameState({
      ...state,
      ...updates,
      status: bothSubmitted || (isPlayer1 && state.p2_predictions.length > 0) || (!isPlayer1 && state.p1_predictions.length > 0)
        ? 'revealing'
        : 'waiting'
    });
  };

  const startNewWeek = async () => {
    const newWeek = getWeekString();
    await updateGameState({
      current_week: newWeek,
      p1_predictions: [],
      p2_predictions: [],
      p1_results: [],
      p2_results: [],
      status: 'submitting',
      player1_id: state.player1_id || selfClientId,
      player2_id: state.player2_id || (state.player1_id === selfClientId ? '' : selfClientId),
      weeks_played: state.weeks_played || 0,
      p1_accuracy_total: state.p1_accuracy_total || 0,
      p2_accuracy_total: state.p2_accuracy_total || 0
    });
    generateQuestions();
  };


  const updatePrediction = (index: number, field: 'question' | 'answer', value: string) => {
    const newPredictions = [...predictions];
    newPredictions[index][field] = value;
    setPredictions(newPredictions);
  };

  const overallAccuracy = state.weeks_played > 0
    ? Math.round(((state.p1_accuracy_total + state.p2_accuracy_total) / (state.weeks_played * 2)) * 100)
    : 0;

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-blue-900/20 via-indigo-900/20 to-purple-900/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-5 pt-5">
        <div>
          <h2 className="font-display text-2xl text-swoono-ink">Future Forecast</h2>
          <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
            Weekly predictions • Week {state.current_week || getWeekString()}
          </p>
        </div>
        <button
          onClick={onExit}
          className="text-swoono-dim text-xs uppercase tracking-widest hover:text-swoono-accent transition-colors"
        >
          Exit
        </button>
      </div>

      {/* Accuracy Stats */}
      <div className="px-5 mb-6">
        <div className="bg-black/40 rounded-xl p-6 border border-white/10 text-center">
          <div className="text-4xl font-bold text-swoono-accent mb-2">
            {overallAccuracy}%
          </div>
          <div className="text-swoono-ink text-lg mb-1">Couple Accuracy</div>
          <div className="text-swoono-dim text-sm">
            {state.weeks_played || 0} weeks played • You know each other {overallAccuracy >= 80 ? 'incredibly well!' : overallAccuracy >= 60 ? 'pretty well!' : 'better every week!'}
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 pb-8">
        {state.status === 'submitting' && !hasSubmitted && (
          /* Submit Predictions */
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl text-swoono-ink mb-2">This Week's Predictions</h3>
              <p className="text-swoono-dim">Make 3 predictions about your partner's week</p>
              <button
                onClick={generateQuestions}
                className="mt-2 text-sm text-swoono-accent hover:text-swoono-accent/80 transition-colors"
              >
                🎲 Generate Random Questions
              </button>
            </div>

            <div className="space-y-6">
              {predictions.map((prediction, index) => (
                <div key={index} className="bg-black/40 rounded-xl p-6 border border-white/10">
                  <div className="text-sm text-swoono-dim mb-3 uppercase tracking-widest">
                    Prediction {index + 1}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-swoono-ink text-sm mb-2">Question</label>
                      <input
                        type="text"
                        value={prediction.question}
                        onChange={(e) => updatePrediction(index, 'question', e.target.value)}
                        placeholder="What will your partner do this week?"
                        className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-swoono-ink placeholder-swoono-dim/60 focus:outline-none focus:border-swoono-accent/50"
                      />
                    </div>

                    <div>
                      <label className="block text-swoono-ink text-sm mb-2">Your Prediction</label>
                      <input
                        type="text"
                        value={prediction.answer}
                        onChange={(e) => updatePrediction(index, 'answer', e.target.value)}
                        placeholder="Your prediction..."
                        className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-swoono-ink placeholder-swoono-dim/60 focus:outline-none focus:border-swoono-accent/50"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={submitPredictions}
              disabled={predictions.some(p => !p.question.trim() || !p.answer.trim())}
              className="w-full mt-6 p-4 bg-swoono-accent text-black font-semibold rounded-xl hover:bg-swoono-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Submit Predictions
            </button>
          </div>
        )}

        {state.status === 'waiting' && hasSubmitted && (
          /* Waiting for Partner */
          <div className="max-w-md mx-auto text-center">
            <div className="text-6xl mb-6">⏳</div>
            <h3 className="text-xl text-swoono-ink mb-4">Predictions Locked In!</h3>
            <p className="text-swoono-dim">
              Waiting for your partner to submit their predictions...
            </p>
            <div className="mt-6 bg-black/40 rounded-xl p-6 border border-white/10">
              <h4 className="text-swoono-ink mb-4">Your Predictions:</h4>
              <div className="space-y-2">
                {(isPlayer1 ? state.p1_predictions : state.p2_predictions).map((pred, index) => (
                  <div key={index} className="text-left">
                    <div className="text-swoono-dim text-xs">Q: {pred.question}</div>
                    <div className="text-swoono-ink text-sm">A: {pred.answer}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {state.status === 'revealing' && bothSubmitted && (
          /* Reveal Results */
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl text-swoono-ink mb-2">Weekly Predictions Revealed!</h3>
              <p className="text-swoono-dim">See how well you predicted each other</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Player 1 Predictions */}
              <div className="space-y-4">
                <h4 className="text-swoono-accent font-semibold text-center">
                  {isPlayer1 ? 'Your' : "Partner's"} Predictions
                </h4>
                {state.p1_predictions.map((pred, index) => (
                  <div key={index} className="bg-black/40 rounded-lg p-4 border border-white/10">
                    <div className="text-swoono-dim text-xs mb-2">{pred.question}</div>
                    <div className="text-swoono-ink">{pred.answer}</div>
                  </div>
                ))}
              </div>

              {/* Player 2 Predictions */}
              <div className="space-y-4">
                <h4 className="text-swoono-accent2 font-semibold text-center">
                  {isPlayer1 ? "Partner's" : 'Your'} Predictions
                </h4>
                {state.p2_predictions.map((pred, index) => (
                  <div key={index} className="bg-black/40 rounded-lg p-4 border border-white/10">
                    <div className="text-swoono-dim text-xs mb-2">{pred.question}</div>
                    <div className="text-swoono-ink">{pred.answer}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 text-center space-y-4">
              <p className="text-swoono-dim">
                Check back at the end of the week to score your accuracy!
              </p>
              <button
                onClick={startNewWeek}
                className="px-8 py-3 bg-swoono-accent text-black font-semibold rounded-lg hover:bg-swoono-accent/80 transition-colors"
              >
                Start New Week
              </button>
            </div>
          </div>
        )}

        {(!state.current_week || state.current_week !== getWeekString()) && (
          /* Start New Week */
          <div className="max-w-md mx-auto text-center">
            <div className="text-6xl mb-6">🔮</div>
            <h3 className="text-xl text-swoono-ink mb-4">Future Forecast</h3>
            <p className="text-swoono-dim mb-6">
              Make weekly predictions about each other. See how well you really know your partner!
            </p>
            <button
              onClick={startNewWeek}
              className="px-8 py-4 bg-swoono-accent text-black font-bold rounded-xl text-lg hover:bg-swoono-accent/80 transition-colors"
            >
              Start This Week's Predictions
            </button>
          </div>
        )}
      </div>
    </div>
  );
}