import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { DrawingGameState, JudgeScore, DrawingJudge } from "../../../../lib/types";

interface JudgePanelProps {
  game: DrawingGameState;
  selfClientId: string;
}

const JUDGE_DATA = {
  fido: {
    name: "Judge Fido",
    emoji: "🐕",
    style: "wholesome, excited, supportive",
    bgColor: "bg-amber-100",
    textColor: "text-amber-900",
    accentColor: "border-amber-300",
  },
  reginald: {
    name: "Reginald Blackthorn",
    emoji: "🎩",
    style: "serious, dry, sharp art critic",
    bgColor: "bg-gray-100",
    textColor: "text-gray-900",
    accentColor: "border-gray-400",
  },
  veloura: {
    name: "Veloura",
    emoji: "✨",
    style: "fabulous, stylish, witty, sparkly",
    bgColor: "bg-pink-100",
    textColor: "text-pink-900",
    accentColor: "border-pink-300",
  },
} as const;

export default function JudgePanel({ game, selfClientId }: JudgePanelProps) {
  const [revealedJudges, setRevealedJudges] = useState<number>(0);

  // Initialize with first judge shown
  useEffect(() => {
    if (game.phase === "judging" && revealedJudges === 0) {
      setRevealedJudges(1);
    }
  }, [game.phase, revealedJudges]);

  const revealNextJudge = () => {
    if (revealedJudges < game.judgeScores.length) {
      setRevealedJudges(prev => prev + 1);
    }
  };

  if (game.phase === "complete") {
    return <CompletedView game={game} selfClientId={selfClientId} />;
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="text-center mb-6">
        <h3 className="text-xl font-display text-swoono-ink mb-2">
          The Judges' Verdict
        </h3>
        <p className="text-swoono-dim text-sm">
          Our panel of expert judges has reviewed both drawings...
        </p>
      </div>

      <div className="flex-1 flex flex-col gap-4">
        {game.judgeScores.map((judgeScore, index) => (
          <JudgeCard
            key={judgeScore.judge}
            judge={judgeScore.judge}
            score={judgeScore}
            revealed={index < revealedJudges}
            delay={index * 500}
          />
        ))}
      </div>

      {/* Next Judge or Complete button */}
      <div className="text-center mt-6">
        {revealedJudges < game.judgeScores.length ? (
          <button
            onClick={revealNextJudge}
            className="px-6 py-3 bg-swoono-accent text-white rounded-xl font-medium hover:bg-swoono-accent/90 transition-colors"
          >
            Next Judge ({revealedJudges}/{game.judgeScores.length})
          </button>
        ) : (
          <div>
            <p className="text-swoono-accent text-lg font-medium">
              All judges have spoken! 🎉
            </p>
            <p className="text-swoono-dim text-sm mt-2">
              Great job, both of you!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function JudgeCard({
  judge,
  score,
  revealed,
  delay,
}: {
  judge: DrawingJudge;
  score: JudgeScore;
  revealed: boolean;
  delay: number;
}) {
  const judgeInfo = JUDGE_DATA[judge];
  const [showScore, setShowScore] = useState(false);

  useEffect(() => {
    if (revealed) {
      const timer = setTimeout(() => setShowScore(true), delay + 500);
      return () => clearTimeout(timer);
    }
  }, [revealed, delay]);

  if (!revealed) {
    return (
      <div className={`p-4 rounded-xl border-2 border-dashed ${judgeInfo.accentColor} bg-white/5`}>
        <div className="flex items-center gap-3">
          <div className="text-3xl opacity-50">{judgeInfo.emoji}</div>
          <div>
            <div className="font-display text-lg text-swoono-dim">{judgeInfo.name}</div>
            <div className="text-swoono-dim/70 text-sm">Preparing judgment...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay / 1000 }}
      className={`p-4 rounded-xl border-2 ${judgeInfo.accentColor} ${judgeInfo.bgColor}`}
    >
      <div className="flex items-start gap-4">
        {/* Judge avatar and info */}
        <div className="flex-shrink-0">
          <div className="text-4xl mb-2">{judgeInfo.emoji}</div>
          <div className="font-display text-lg font-bold text-gray-800">
            {judgeInfo.name}
          </div>
        </div>

        {/* Score and comment */}
        <div className="flex-1">
          {showScore && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ScoreDisplay score={score.score} judge={judge} />
              <div className={`mt-3 ${judgeInfo.textColor} text-lg font-medium leading-relaxed`}>
                "{score.comment}"
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ScoreDisplay({ score, judge }: { score: number; judge: DrawingJudge }) {
  const getScoreStyle = (judge: DrawingJudge, score: number) => {
    if (judge === "fido") {
      return score >= 8 ? "bg-green-500" : score >= 6 ? "bg-yellow-500" : "bg-orange-500";
    } else if (judge === "reginald") {
      return score >= 8 ? "bg-purple-500" : score >= 6 ? "bg-blue-500" : "bg-gray-500";
    } else { // veloura
      return score >= 8 ? "bg-pink-500" : score >= 6 ? "bg-rose-500" : "bg-indigo-500";
    }
  };

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 10,
        delay: 0.2
      }}
      className="flex items-center gap-2"
    >
      <div className={`
        w-16 h-16 rounded-full flex items-center justify-center
        text-white font-bold text-2xl shadow-lg
        ${getScoreStyle(judge, score)}
      `}>
        {score}
      </div>
      <div className="text-gray-600 font-medium">/ 10</div>
    </motion.div>
  );
}

function CompletedView({ game }: { game: DrawingGameState; selfClientId: string }) {
  const averageScore = game.judgeScores.reduce((sum, j) => sum + j.score, 0) / game.judgeScores.length;

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md"
      >
        <div className="text-6xl mb-4">🎨</div>
        <h3 className="text-2xl font-display text-swoono-ink mb-4">
          Drawing Complete!
        </h3>

        <div className="bg-white/10 rounded-xl p-6 mb-6">
          <div className="text-3xl font-bold text-swoono-accent mb-2">
            {averageScore.toFixed(1)}/10
          </div>
          <div className="text-swoono-dim text-sm">Average Judge Score</div>
        </div>

        <p className="text-swoono-dim text-sm leading-relaxed mb-6">
          Great creativity from both artists!
          The judges were thoroughly entertained by your interpretations of "{game.prompt}".
        </p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="text-swoono-accent text-sm"
        >
          🏆 +15 points for completing the drawing challenge!
        </motion.div>
      </motion.div>
    </div>
  );
}