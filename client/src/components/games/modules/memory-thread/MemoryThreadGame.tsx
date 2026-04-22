import { useEffect, useState } from "react";
import { getSupabase } from "../../../../lib/supabase";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";

type MemoryEntry = {
  id: string;
  author_id: string;
  text: string;
  emoji: string;
  timestamp: string;
};

type MemoryThread = {
  id: string;
  room_code: string;
  thread_title: string;
  entries: MemoryEntry[];
  created_by: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export default function MemoryThreadGame({
  roomCode,
  selfClientId,
  onExit,
}: GameContextProps) {
  const [threads, setThreads] = useState<MemoryThread[]>([]);
  const [activeThread, setActiveThread] = useState<MemoryThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("💭");

  const emojis = ["💭", "❤️", "😊", "🌟", "🎉", "💑", "🏠", "🌸", "☀️", "🌙", "🎈", "💫"];

  // Load threads on mount
  useEffect(() => {
    loadThreads();
  }, [roomCode]);

  // Subscribe to realtime updates
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const subscription = supabase
      .channel(`memory_threads:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'memory_threads',
          filter: `room_code=eq.${roomCode}`
        },
        (payload) => {
          console.log('Memory thread update:', payload);
          loadThreads(); // Reload threads on any change
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [roomCode]);

  const loadThreads = async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('memory_threads')
        .select('*')
        .eq('room_code', roomCode)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setThreads(data || []);
      if (data && data.length > 0 && !activeThread) {
        setActiveThread(data[0]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to load threads:', error);
      setLoading(false);
    }
  };

  const createThread = async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('memory_threads')
        .insert({
          room_code: roomCode,
          thread_title: `Our Story ${threads.length + 1}`,
          entries: [],
          created_by: selfClientId
        })
        .select('*')
        .single();

      if (error) throw error;

      setActiveThread(data);
      await loadThreads();
    } catch (error) {
      console.error('Failed to create thread:', error);
    }
  };

  const addMemory = async () => {
    if (!activeThread || !newMemoryText.trim()) return;

    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const newEntry: MemoryEntry = {
        id: crypto.randomUUID(),
        author_id: selfClientId,
        text: newMemoryText.trim(),
        emoji: selectedEmoji,
        timestamp: new Date().toISOString()
      };

      const updatedEntries = [...activeThread.entries, newEntry];

      const { error } = await supabase
        .from('memory_threads')
        .update({
          entries: updatedEntries,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeThread.id);

      if (error) throw error;

      setNewMemoryText("");
      setSelectedEmoji("💭");
    } catch (error) {
      console.error('Failed to add memory:', error);
    }
  };

  const togglePin = async (threadId: string) => {
    const supabase = getSupabase();
    if (!supabase) return;

    const thread = threads.find(t => t.id === threadId);
    if (!thread) return;

    try {
      const { error } = await supabase
        .from('memory_threads')
        .update({ pinned: !thread.pinned })
        .eq('id', threadId);

      if (error) throw error;
      await loadThreads();
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-swoono-dim">
        Loading your memories…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-rose-50/5 via-cream-50/5 to-amber-50/5">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-5 pt-5">
        <div>
          <h2 className="font-display text-2xl text-swoono-ink">Memory Thread</h2>
          <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
            {threads.length > 0 ? `${threads.reduce((acc, t) => acc + t.entries.length, 0)} memories together` : 'Start your story'}
          </p>
        </div>
        <button
          onClick={onExit}
          className="text-swoono-dim text-xs uppercase tracking-widest hover:text-swoono-accent transition-colors"
        >
          Exit
        </button>
      </div>

      <div className="flex-1 flex">
        {/* Thread List Sidebar */}
        <div className="w-1/3 p-5 border-r border-white/10">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm uppercase tracking-widest text-swoono-dim">Threads</h3>
            {threads.length < 3 && ( // Free limit
              <button
                onClick={createThread}
                className="text-xs bg-swoono-accent/20 text-swoono-accent px-3 py-1 rounded hover:bg-swoono-accent/30 transition-colors"
              >
                + New
              </button>
            )}
          </div>

          {threads.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📖</div>
              <p className="text-swoono-dim text-sm mb-4">No memories yet</p>
              <button
                onClick={createThread}
                className="bg-swoono-accent text-black px-4 py-2 rounded font-semibold hover:bg-swoono-accent/80 transition-colors"
              >
                Start Your Story
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => setActiveThread(thread)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    activeThread?.id === thread.id
                      ? 'bg-white/10 border-swoono-accent/40 text-swoono-ink'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-swoono-dim hover:text-swoono-ink'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium">{thread.thread_title}</span>
                    {thread.pinned && <span className="text-amber-400">📌</span>}
                  </div>
                  <div className="text-xs text-swoono-dim">
                    {thread.entries.length} memories
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(thread.id);
                    }}
                    className="mt-2 text-xs text-swoono-dim/60 hover:text-swoono-accent transition-colors"
                  >
                    {thread.pinned ? 'Unpin' : 'Pin'}
                  </button>
                </button>
              ))}

              {threads.length >= 3 && (
                <div className="text-center py-4 text-xs text-swoono-dim/70 border border-amber-500/30 bg-amber-500/10 rounded-lg">
                  <div className="text-amber-400 mb-1">🔒 Free Limit Reached</div>
                  Upgrade for unlimited threads
                </div>
              )}
            </div>
          )}
        </div>

        {/* Active Thread Content */}
        <div className="flex-1 flex flex-col">
          {!activeThread ? (
            <div className="flex-1 flex items-center justify-center text-swoono-dim">
              Select a thread to view memories
            </div>
          ) : (
            <>
              {/* Thread Messages */}
              <div className="flex-1 p-5 overflow-y-auto">
                <div className="max-w-2xl mx-auto">
                  {activeThread.entries.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">💫</div>
                      <h3 className="text-lg text-swoono-ink mb-2">Empty Thread</h3>
                      <p className="text-swoono-dim">Add your first memory below</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activeThread.entries.map((entry) => {
                        const isMyMessage = entry.author_id === selfClientId;
                        return (
                          <div
                            key={entry.id}
                            className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-sm p-4 rounded-2xl ${
                                isMyMessage
                                  ? 'bg-swoono-accent/20 text-swoono-ink border border-swoono-accent/30'
                                  : 'bg-white/10 text-swoono-ink border border-white/20'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <span className="text-xl">{entry.emoji}</span>
                                <div className="flex-1">
                                  <p className="text-sm leading-relaxed">{entry.text}</p>
                                  <div className="text-xs text-swoono-dim/70 mt-2">
                                    {new Date(entry.timestamp).toLocaleDateString()}
                                  </div>
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
                    {/* Emoji Picker */}
                    <select
                      value={selectedEmoji}
                      onChange={(e) => setSelectedEmoji(e.target.value)}
                      className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-swoono-ink"
                    >
                      {emojis.map((emoji) => (
                        <option key={emoji} value={emoji} className="bg-gray-800">
                          {emoji}
                        </option>
                      ))}
                    </select>

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
            </>
          )}
        </div>
      </div>
    </div>
  );
}