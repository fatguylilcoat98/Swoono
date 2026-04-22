import { useState, useEffect } from 'react';
import { getSupabase } from '../lib/supabase';

export type GameSessionState = {
  id: string;
  room_code: string;
  game_type: string;
  player1_id: string | null;
  player2_id: string | null;
  game_state: Record<string, unknown>;
  current_turn: string | null;
  status: "waiting" | "active" | "finished";
  created_at: string;
  updated_at: string;
};

export function useGameSession(roomCode: string) {
  const [gameState, setGameState] = useState<GameSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!roomCode) return;

    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Load initial state
    const loadSession = async () => {
      try {
        const { data, error } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('room_code', roomCode)
          .in('status', ['waiting', 'active'])
          .order('created_at', { ascending: false })
          .maybeSingle();

        if (error) {
          setError(error);
        } else {
          setGameState(data);
        }
        setLoading(false);
      } catch (err) {
        setError(err as Error);
        setLoading(false);
      }
    };

    loadSession();

    // Subscribe to realtime updates
    // No polling. No refresh. Database pushes updates.
    const subscription = supabase
      .channel(`game:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_sessions',
          filter: `room_code=eq.${roomCode}`
        },
        (payload) => {
          console.log('Game session update:', payload);
          if (payload.new) {
            setGameState(payload.new as GameSessionState);
          } else if (payload.eventType === 'DELETE') {
            setGameState(null);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [roomCode]);

  const updateGameState = async (newState: Record<string, unknown>) => {
    const supabase = getSupabase();
    if (!supabase || !gameState) return;

    try {
      const { error } = await supabase
        .from('game_sessions')
        .update({
          game_state: newState,
          updated_at: new Date().toISOString()
        })
        .eq('id', gameState.id);

      if (error) {
        console.error('State update failed:', error);
        setError(error);
      }
    } catch (err) {
      console.error('State update failed:', err);
      setError(err as Error);
    }
  };

  const createSession = async (gameType: string, playerId?: string) => {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('game_sessions')
        .insert({
          room_code: roomCode,
          game_type: gameType,
          player1_id: playerId || null,
          status: 'waiting',
        })
        .select('*')
        .single();

      if (error) {
        console.error('Session creation failed:', error);
        setError(error);
        return null;
      }

      return data as GameSessionState;
    } catch (err) {
      console.error('Session creation failed:', err);
      setError(err as Error);
      return null;
    }
  };

  return {
    gameState,
    loading,
    error,
    updateGameState,
    createSession
  };
}