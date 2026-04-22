import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabase";

type DailyPrompt = {
  id: string;
  room_code: string;
  prompt_date: string;
  question: string;
  p1_answer: string | null;
  p2_answer: string | null;
  p1_submitted: boolean;
  p2_submitted: boolean;
  revealed: boolean;
  created_at: string;
};

type DailyPromptProps = {
  roomCode: string;
  selfClientId: string;
};

export default function DailyPrompt({ roomCode }: DailyPromptProps) {
  const [todayPrompt, setTodayPrompt] = useState<DailyPrompt | null>(null);
  const [yesterdayPrompt, setYesterdayPrompt] = useState<DailyPrompt | null>(null);
  const [answer, setAnswer] = useState("");
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Color rotation by day of week
  const dayOfWeek = new Date().getDay();
  const gradients = [
    'from-purple-500/20 to-pink-500/20', // Sunday
    'from-blue-500/20 to-cyan-500/20',   // Monday
    'from-green-500/20 to-emerald-500/20', // Tuesday
    'from-orange-500/20 to-red-500/20',   // Wednesday
    'from-indigo-500/20 to-purple-500/20', // Thursday
    'from-rose-500/20 to-pink-500/20',    // Friday
    'from-amber-500/20 to-orange-500/20'  // Saturday
  ];

  // Load today's and yesterday's prompts
  useEffect(() => {
    loadPrompts();
    calculateStreak();
  }, [roomCode]);

  // Subscribe to realtime updates
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const subscription = supabase
      .channel(`daily_prompts:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_prompts',
          filter: `room_code=eq.${roomCode}`
        },
        (payload) => {
          console.log('Daily prompt update:', payload);
          loadPrompts();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [roomCode]);

  const loadPrompts = async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      // Get today's prompt
      const { data: todayData, error: todayError } = await supabase
        .from('daily_prompts')
        .select('*')
        .eq('room_code', roomCode)
        .eq('prompt_date', today)
        .maybeSingle();

      if (todayError && todayError.code !== 'PGRST116') throw todayError;

      // Get yesterday's prompt
      const { data: yesterdayData, error: yesterdayError } = await supabase
        .from('daily_prompts')
        .select('*')
        .eq('room_code', roomCode)
        .eq('prompt_date', yesterday)
        .maybeSingle();

      if (yesterdayError && yesterdayError.code !== 'PGRST116') throw yesterdayError;

      // If no prompt for today, create one
      if (!todayData) {
        await createTodayPrompt();
      } else {
        setTodayPrompt(todayData);
      }

      setYesterdayPrompt(yesterdayData);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load prompts:', error);
      setLoading(false);
    }
  };

  const createTodayPrompt = async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      // Get a random question from prompt bank
      const { data: questions, error: questionsError } = await supabase
        .from('prompt_bank')
        .select('question')
        .order('RANDOM()')
        .limit(1)
        .single();

      if (questionsError) throw questionsError;

      const { data, error } = await supabase
        .from('daily_prompts')
        .insert({
          room_code: roomCode,
          prompt_date: today,
          question: questions.question
        })
        .select('*')
        .single();

      if (error) throw error;
      setTodayPrompt(data);
    } catch (error) {
      console.error('Failed to create today prompt:', error);
    }
  };

  const submitAnswer = async () => {
    if (!todayPrompt || !answer.trim()) return;

    const supabase = getSupabase();
    if (!supabase) return;

    try {
      // Determine which player we are (simplified - assumes 2 players)
      const isPlayer1 = true; // TODO: Determine player position properly

      const updates = isPlayer1
        ? { p1_answer: answer.trim(), p1_submitted: true }
        : { p2_answer: answer.trim(), p2_submitted: true };

      const { error } = await supabase
        .from('daily_prompts')
        .update(updates)
        .eq('id', todayPrompt.id);

      if (error) throw error;

      setAnswer("");
      await loadPrompts();
      await calculateStreak();
    } catch (error) {
      console.error('Failed to submit answer:', error);
    }
  };

  const calculateStreak = async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      // Get recent prompts to calculate streak
      const { data, error } = await supabase
        .from('daily_prompts')
        .select('prompt_date, p1_submitted, p2_submitted')
        .eq('room_code', roomCode)
        .order('prompt_date', { ascending: false })
        .limit(30);

      if (error) throw error;

      let currentStreak = 0;
      for (const prompt of data || []) {
        if (prompt.p1_submitted && prompt.p2_submitted) {
          currentStreak++;
        } else {
          break;
        }
      }

      setStreak(currentStreak);
    } catch (error) {
      console.error('Failed to calculate streak:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-black/40 rounded-xl p-6 border border-white/10 mb-6">
        <div className="animate-pulse">
          <div className="h-4 bg-white/10 rounded w-3/4 mb-4"></div>
          <div className="h-8 bg-white/10 rounded mb-4"></div>
          <div className="h-10 bg-white/10 rounded"></div>
        </div>
      </div>
    );
  }

  if (!todayPrompt) {
    return (
      <div className="bg-black/40 rounded-xl p-6 border border-white/10 mb-6">
        <div className="text-center text-swoono-dim">
          Unable to load today's prompt. Please try again.
        </div>
      </div>
    );
  }

  const hasSubmitted = todayPrompt.p1_submitted; // TODO: Check correct player
  const bothSubmitted = todayPrompt.p1_submitted && todayPrompt.p2_submitted;

  return (
    <div className={`bg-gradient-to-r ${gradients[dayOfWeek]} rounded-xl p-6 border border-white/10 mb-6`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-display text-swoono-ink">Today's Question</h3>
          <div className="text-xs text-swoono-dim uppercase tracking-widest">
            Daily Prompt • {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
          </div>
        </div>
        {streak > 0 && (
          <div className="text-center">
            <div className="text-xl font-bold text-swoono-accent">
              🔥 {streak}
            </div>
            <div className="text-xs text-swoono-dim">day streak</div>
          </div>
        )}
      </div>

      {/* Question */}
      <div className="mb-6">
        <div className="bg-black/40 rounded-lg p-4 border border-white/10">
          <p className="text-swoono-ink text-lg leading-relaxed">
            {todayPrompt.question}
          </p>
        </div>
      </div>

      {!hasSubmitted ? (
        /* Answer Form */
        <div className="space-y-4">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your answer..."
            maxLength={500}
            className="w-full p-4 bg-black/40 border border-white/20 rounded-lg text-swoono-ink placeholder-swoono-dim/60 focus:outline-none focus:border-swoono-accent/50 resize-none"
            rows={3}
          />
          <div className="flex justify-between items-center">
            <div className="text-xs text-swoono-dim/60">
              {answer.length}/500 characters
            </div>
            <button
              onClick={submitAnswer}
              disabled={!answer.trim()}
              className="px-6 py-2 bg-swoono-accent text-black font-semibold rounded-lg hover:bg-swoono-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Submit Answer
            </button>
          </div>
        </div>
      ) : !bothSubmitted ? (
        /* Waiting for Partner */
        <div className="text-center py-4">
          <div className="text-2xl mb-2">⏳</div>
          <div className="text-swoono-ink font-semibold mb-1">Answer submitted!</div>
          <div className="text-swoono-dim text-sm">
            Waiting for your partner's answer...
          </div>
        </div>
      ) : (
        /* Both Answered - Show Results */
        <div className="space-y-4">
          <div className="text-center text-swoono-accent font-semibold mb-4">
            ✨ Both answered! ✨
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/40 rounded-lg p-4 border border-white/10">
              <div className="text-swoono-dim text-xs mb-2">YOUR ANSWER</div>
              <div className="text-swoono-ink">{todayPrompt.p1_answer}</div>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-white/10">
              <div className="text-swoono-dim text-xs mb-2">PARTNER'S ANSWER</div>
              <div className="text-swoono-ink">{todayPrompt.p2_answer}</div>
            </div>
          </div>
        </div>
      )}

      {/* Yesterday's Answers Link */}
      {yesterdayPrompt && yesterdayPrompt.p1_submitted && yesterdayPrompt.p2_submitted && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <details className="cursor-pointer">
            <summary className="text-sm text-swoono-accent hover:text-swoono-accent/80 transition-colors">
              See yesterday's answers
            </summary>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-black/20 rounded p-3">
                <div className="text-xs text-swoono-dim mb-1">"{yesterdayPrompt.question}"</div>
                <div className="text-sm text-swoono-ink">Your: {yesterdayPrompt.p1_answer}</div>
              </div>
              <div className="bg-black/20 rounded p-3">
                <div className="text-xs text-swoono-dim mb-1">&nbsp;</div>
                <div className="text-sm text-swoono-ink">Partner: {yesterdayPrompt.p2_answer}</div>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}