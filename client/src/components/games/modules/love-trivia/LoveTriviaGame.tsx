import { useEffect, useState, type ReactNode } from "react";
import { useRoomStore } from "../../../../state/roomStore";
import { triggerEffect } from "../../../../lib/registries/effectRegistry";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";
import type { LoveTriviaState } from "../../../../lib/types";

// Neon visual wrapper — Couples Trivia is a "special area" (Chris's
// spec). Animated gradient + scanlines + glowing frame so this game
// pops visually vs the rest of the game panel.
function NeonFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex-1 flex flex-col relative rounded-xl overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 20% 10%, rgba(255,77,143,0.22), transparent 55%), " +
          "radial-gradient(ellipse at 80% 90%, rgba(0,200,255,0.18), transparent 55%), " +
          "linear-gradient(135deg, #1a0a2e 0%, #0d0420 50%, #1a0a2e 100%)",
        boxShadow:
          "inset 0 0 60px rgba(255,77,143,0.2), " +
          "inset 0 0 120px rgba(0,180,255,0.08), " +
          "0 0 40px rgba(255,77,143,0.25)",
        border: "1px solid rgba(255,77,143,0.35)",
      }}
    >
      {/* Scanlines overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 3px)",
          mixBlendMode: "overlay",
        }}
      />
      {/* Corner accent — pulsing heart */}
      <div
        className="absolute top-3 right-3 text-2xl pointer-events-none select-none"
        style={{
          filter: "drop-shadow(0 0 8px rgba(255,77,143,0.9))",
          animation: "neonPulse 1.8s ease-in-out infinite",
        }}
      >
        💞
      </div>
      <style>{`
        @keyframes neonPulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes neonFlicker {
          0%, 100% { text-shadow: 0 0 8px #ff4d8f, 0 0 20px #ff4d8f, 0 0 40px #ff4d8f; }
          50% { text-shadow: 0 0 12px #ff4d8f, 0 0 28px #ff4d8f, 0 0 56px #ff4d8f; }
        }
      `}</style>
      <div className="relative flex-1 flex flex-col p-4">{children}</div>
    </div>
  );
}

// Couples Trivia — Newlywed-style two-phase game.
//
//   Setup: each player predicts what their partner will answer on all
//          10 questions, in parallel (no turn-taking). Fast-fill view.
//   Game:  both players answer for themselves one question at a time.
//          After both answer, reveal partner's prediction vs actual.
//   Done:  final scores — how well each of you knows the other.

export default function LoveTriviaGame({
  selfClientId,
  onExit,
  onAwardPoints,
}: GameContextProps) {
  const activeGame = useRoomStore((s) => s.activeGame);
  const game: LoveTriviaState | null =
    activeGame && activeGame.gameId === "love-trivia" ? activeGame : null;
  const submitAnswer = useRoomStore((s) => s.submitLoveTriviaAnswer);
  const submitPrediction = useRoomStore(
    (s) => s.submitLoveTriviaSetupPrediction,
  );

  const [awarded, setAwarded] = useState(false);
  const [revealHoldIdx, setRevealHoldIdx] = useState<number | null>(null);

  const myIdx: 0 | 1 | null = game
    ? game.players[0].clientId === selfClientId
      ? 0
      : game.players[1].clientId === selfClientId
        ? 1
        : null
    : null;
  const partnerIdx = myIdx === 0 ? 1 : 0;

  // When a new round's answers both land, hold the reveal for ~2.5s
  // before letting the component advance to the next question.
  useEffect(() => {
    if (!game || myIdx === null) return;
    if (game.phase !== "game") return;
    const completedIdx = game.currentIdx - 1;
    if (completedIdx < 0) return;
    const myA = game.gameAnswers[myIdx][completedIdx];
    const theirA = game.gameAnswers[partnerIdx][completedIdx];
    if (myA !== null && theirA !== null) {
      setRevealHoldIdx(completedIdx);
      const t = window.setTimeout(() => setRevealHoldIdx(null), 2500);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.currentIdx, game?.phase]);

  // Fire win/lose effects + points on completion
  useEffect(() => {
    if (!game || game.winner !== "done" || awarded || myIdx === null) return;
    setAwarded(true);
    const myScore = game.scores[myIdx];
    const pts = Math.min(20, myScore * 2);
    if (myScore >= 6) {
      onAwardPoints(pts, `Couples Trivia ${myScore}/10`);
      triggerEffect({
        effectId: "effect.game.win",
        fromClientId: selfClientId,
      });
    } else if (myScore >= 3) {
      onAwardPoints(pts, `Couples Trivia ${myScore}/10`);
    } else {
      triggerEffect({
        effectId: "effect.game.lose",
        fromClientId: selfClientId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.winner]);

  if (!game) {
    return (
      <div className="flex-1 flex items-center justify-center text-swoono-dim">
        Starting game…
      </div>
    );
  }

  const opponent = game.players[partnerIdx];
  const opponentName = opponent?.name ?? "partner";

  // ──────────────────────────────────────────────────────────────
  // Phase: SETUP
  // ──────────────────────────────────────────────────────────────
  if (game.phase === "setup") {
    const myPreds = myIdx !== null ? game.setupPredictions[myIdx] : [];
    const mineDone = myPreds.every((v) => v !== null);
    const partnerPreds =
      myIdx !== null ? game.setupPredictions[partnerIdx] : [];
    const partnerDone = partnerPreds.every((v) => v !== null);

    // Pick the first unanswered question for me. If all answered, show
    // the waiting screen until the partner is done too.
    const nextIdx = myPreds.findIndex((v) => v === null);
    const currentQIdx = nextIdx >= 0 ? nextIdx : myPreds.length - 1;
    const q = game.questions[currentQIdx];

    return (
      <NeonFrame>
        <Header
          title="Couples Trivia"
          subtitle={`Setup · Question ${Math.min(
            currentQIdx + 1,
            game.questions.length,
          )} of ${game.questions.length}`}
          opponentName={opponentName}
          onExit={onExit}
        />

        <p className="text-center text-xs uppercase tracking-widest text-swoono-dim mb-2">
          How well do you know {opponentName}?
        </p>
        <p className="text-center text-[11px] text-swoono-dim mb-6">
          Predict what {opponentName} will answer. Both of you answer
          all 10 questions, then the real game starts.
        </p>

        {mineDone ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <div className="text-4xl">✓</div>
            <p className="text-swoono-ink">Your predictions are in.</p>
            <p className="text-swoono-dim text-sm">
              {partnerDone
                ? "Starting the real round…"
                : `Waiting on ${opponentName}…`}
            </p>
          </div>
        ) : q ? (
          <div className="flex-1 flex flex-col">
            <p className="text-swoono-dim text-[10px] uppercase tracking-widest text-center mb-3">
              What would {opponentName} answer?
            </p>
            <p className="text-xl text-swoono-ink text-center leading-snug mb-6 px-4">
              {q.text}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {q.choices.map((choice, idx) => (
                <button
                  key={idx}
                  onClick={() =>
                    myIdx !== null && submitPrediction(currentQIdx, idx)
                  }
                  className="px-4 py-4 rounded-lg border bg-white/5 border-white/10 text-sm text-left text-swoono-ink hover:bg-white/10 hover:border-swoono-accent/40 transition-colors"
                >
                  {choice}
                </button>
              ))}
            </div>

            <p className="text-[10px] uppercase tracking-widest text-swoono-dim text-center">
              {myPreds.filter((v) => v !== null).length} / 10 submitted
            </p>
          </div>
        ) : null}
      </NeonFrame>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Phase: DONE
  // ──────────────────────────────────────────────────────────────
  if (game.phase === "done" && myIdx !== null) {
    const myScore = game.scores[myIdx];
    const theirScore = game.scores[partnerIdx];
    const summary =
      myScore >= 8
        ? "You two are locked in."
        : myScore >= 5
          ? "Pretty in sync. Keep learning each other."
          : myScore >= 3
            ? "Some wins, lots to discover."
            : "Plenty to learn about each other.";
    return (
      <NeonFrame>
        <Header
          title="Couples Trivia"
          subtitle="Final"
          opponentName={opponentName}
          onExit={onExit}
        />
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 px-4">
          <div className="text-5xl">💞</div>
          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            <div className="bg-swoono-accent/10 border border-swoono-accent/30 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-swoono-dim">
                You know {opponentName}
              </p>
              <p className="text-3xl font-display text-swoono-accent mt-1">
                {myScore} / 10
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-swoono-dim">
                {opponentName} knows you
              </p>
              <p className="text-3xl font-display text-swoono-ink mt-1">
                {theirScore} / 10
              </p>
            </div>
          </div>
          <p className="text-swoono-ink mt-3">{summary}</p>
          <button
            onClick={onExit}
            className="mt-6 px-6 py-3 bg-swoono-accent text-black uppercase tracking-widest text-xs font-semibold rounded"
          >
            Back to games
          </button>
        </div>
      </NeonFrame>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Phase: GAME
  // ──────────────────────────────────────────────────────────────
  const idx =
    revealHoldIdx !== null ? revealHoldIdx : game.currentIdx;
  const q = game.questions[idx];
  if (!q || myIdx === null) {
    return (
      <div className="flex-1 flex items-center justify-center text-swoono-dim">
        Loading…
      </div>
    );
  }

  const myAnswer = game.gameAnswers[myIdx][idx];
  const partnerAnswer = game.gameAnswers[partnerIdx][idx];
  const bothAnswered = myAnswer !== null && partnerAnswer !== null;
  const showingReveal = revealHoldIdx !== null;

  // In reveal mode, show both answers + whether partner predicted
  // correctly. Otherwise show the question for the current player.
  return (
    <NeonFrame>
      <Header
        title="Couples Trivia"
        subtitle={`Round ${idx + 1} of ${game.questions.length}`}
        opponentName={opponentName}
        onExit={onExit}
      />

      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-swoono-dim mb-4">
        <span>
          You know {opponentName}:{" "}
          <span className="text-swoono-accent">{game.scores[myIdx]}</span>
        </span>
        <span>
          {opponentName} knows you:{" "}
          <span className="text-swoono-accent">
            {game.scores[partnerIdx]}
          </span>
        </span>
      </div>

      {showingReveal && bothAnswered ? (
        <div className="flex-1 flex flex-col gap-4 px-2">
          <p className="text-center text-xs uppercase tracking-widest text-swoono-dim">
            Reveal
          </p>
          <p className="text-lg text-swoono-ink text-center leading-snug mb-2">
            {q.text}
          </p>

          <RevealRow
            label={`You said`}
            chosen={q.choices[myAnswer as number]}
            partnerPrediction={q.choices[game.setupPredictions[partnerIdx][idx] ?? 0]}
            matched={
              game.setupPredictions[partnerIdx][idx] === myAnswer
            }
            predicterName={opponentName}
          />
          <RevealRow
            label={`${opponentName} said`}
            chosen={q.choices[partnerAnswer as number]}
            partnerPrediction={q.choices[game.setupPredictions[myIdx][idx] ?? 0]}
            matched={
              game.setupPredictions[myIdx][idx] === partnerAnswer
            }
            predicterName="You"
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <p className="text-center text-[11px] uppercase tracking-widest text-swoono-dim mb-3">
            This is about YOU — answer honestly
          </p>
          <p className="text-xl text-swoono-ink text-center leading-snug mb-6 px-4">
            {q.text}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {q.choices.map((choice, i) => {
              const isMine = myAnswer === i;
              const disabled = myAnswer !== null;
              return (
                <button
                  key={i}
                  onClick={() => !disabled && submitAnswer(i)}
                  disabled={disabled}
                  className={`px-4 py-4 rounded-lg border text-sm text-left transition-colors ${
                    isMine
                      ? "bg-swoono-accent/20 border-swoono-accent text-swoono-accent"
                      : disabled
                        ? "bg-white/5 border-white/10 text-swoono-dim cursor-not-allowed"
                        : "bg-white/5 border-white/10 text-swoono-ink hover:bg-white/10 hover:border-swoono-accent/40"
                  }`}
                >
                  {choice}
                </button>
              );
            })}
          </div>

          <p className="text-center text-[11px] uppercase tracking-widest text-swoono-dim">
            {myAnswer === null
              ? "Tap your answer"
              : partnerAnswer !== null
                ? "Revealing…"
                : `Waiting on ${opponentName}…`}
          </p>
        </div>
      )}
    </NeonFrame>
  );
}

function Header({
  title,
  subtitle,
  opponentName,
  onExit,
}: {
  title: string;
  subtitle: string;
  opponentName: string;
  onExit: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2
          className="font-display text-2xl"
          style={{
            color: "#ff4d8f",
            animation: "neonFlicker 3s ease-in-out infinite",
          }}
        >
          {title}
        </h2>
        <p
          className="text-xs uppercase tracking-widest mt-1"
          style={{ color: "#9fa0c9" }}
        >
          {subtitle} · with{" "}
          <span style={{ color: "#00d4ff" }}>{opponentName}</span>
        </p>
      </div>
      <button
        onClick={onExit}
        className="text-xs uppercase tracking-widest transition-colors"
        style={{ color: "#9fa0c9" }}
      >
        Exit
      </button>
    </div>
  );
}

function RevealRow({
  label,
  chosen,
  partnerPrediction,
  matched,
  predicterName,
}: {
  label: string;
  chosen: string;
  partnerPrediction: string;
  matched: boolean;
  predicterName: string;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        matched
          ? "bg-swoono-accent/10 border-swoono-accent/40"
          : "bg-white/5 border-white/10"
      }`}
    >
      <p className="text-[10px] uppercase tracking-widest text-swoono-dim mb-1">
        {label}
      </p>
      <p className="text-swoono-ink">{chosen}</p>
      <p className="text-[11px] text-swoono-dim mt-2">
        {predicterName} predicted:{" "}
        <span className={matched ? "text-swoono-accent" : "text-swoono-ink"}>
          {partnerPrediction}
        </span>{" "}
        <span className={matched ? "text-swoono-accent" : "text-red-400"}>
          {matched ? "✓ nailed it" : "✗ miss"}
        </span>
      </p>
    </div>
  );
}
