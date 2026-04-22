import { useEffect, useState } from "react";
import { getSupabase } from "../../../../lib/supabase";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";
import { isAdmin } from "../../../../lib/admin";

type CarePackage = {
  id: string;
  room_code: string;
  from_id: string;
  to_id: string;
  message: string;
  emojis: string[];
  delivery_type: string;
  delivery_date: string | null;
  opened: boolean;
  is_emergency: boolean;
  created_at: string;
};

type DeliveryType = 'now' | 'date' | 'random' | 'emergency';

export default function CarePackageGame({
  roomCode,
  selfClientId,
  onExit,
}: GameContextProps) {
  const [packages, setPackages] = useState<CarePackage[]>([]);
  const [sentPackages, setSentPackages] = useState<CarePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);

  // Package composer state
  const [message, setMessage] = useState("");
  const [selectedEmojis, setSelectedEmojis] = useState<string[]>([]);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('now');
  const [deliveryDate, setDeliveryDate] = useState("");
  const [packagesThisMonth, setPackagesThisMonth] = useState(0);

  const emojiOptions = ["❤️", "🌟", "🎉", "☀️", "🌈", "💐", "🍰", "🎁", "🧸", "💌", "🌙", "✨"];
  // ADMIN ACCESS — bypasses all paywalls for authorized users
  const adminAccess = isAdmin();
  const isPremium = adminAccess; // TODO: Get from user state when not admin
  const monthlyLimit = 3;

  // Load packages on mount
  useEffect(() => {
    loadPackages();
    countMonthlyPackages();
  }, [roomCode]);

  // Subscribe to realtime updates
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const subscription = supabase
      .channel(`care_packages:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'care_packages',
          filter: `room_code=eq.${roomCode}`
        },
        (payload) => {
          console.log('Care package update:', payload);
          loadPackages();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [roomCode]);

  const loadPackages = async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      // Load received packages
      const { data: received, error: receivedError } = await supabase
        .from('care_packages')
        .select('*')
        .eq('room_code', roomCode)
        .eq('to_id', selfClientId)
        .order('created_at', { ascending: false });

      if (receivedError) throw receivedError;

      // Load sent packages
      const { data: sent, error: sentError } = await supabase
        .from('care_packages')
        .select('*')
        .eq('room_code', roomCode)
        .eq('from_id', selfClientId)
        .order('created_at', { ascending: false });

      if (sentError) throw sentError;

      setPackages(received || []);
      setSentPackages(sent || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load care packages:', error);
      setLoading(false);
    }
  };

  const countMonthlyPackages = async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { count, error } = await supabase
        .from('care_packages')
        .select('*', { count: 'exact', head: true })
        .eq('room_code', roomCode)
        .eq('from_id', selfClientId)
        .gte('created_at', firstDay);

      if (error) throw error;
      setPackagesThisMonth(count || 0);
    } catch (error) {
      console.error('Failed to count monthly packages:', error);
    }
  };

  const sendPackage = async () => {
    if (!message.trim() || (!isPremium && packagesThisMonth >= monthlyLimit)) return;

    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const packageData = {
        room_code: roomCode,
        from_id: selfClientId,
        to_id: "partner", // TODO: Get partner ID
        message: message.trim(),
        emojis: selectedEmojis,
        delivery_type: deliveryType,
        delivery_date: deliveryType === 'date' ? new Date(deliveryDate).toISOString() : null,
        is_emergency: deliveryType === 'emergency'
      };

      const { error } = await supabase
        .from('care_packages')
        .insert(packageData);

      if (error) throw error;

      // Reset form
      setMessage("");
      setSelectedEmojis([]);
      setDeliveryType('now');
      setDeliveryDate("");
      setShowComposer(false);

      await loadPackages();
      await countMonthlyPackages();
    } catch (error) {
      console.error('Failed to send care package:', error);
    }
  };

  const openPackage = async (packageId: string) => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('care_packages')
        .update({ opened: true })
        .eq('id', packageId);

      if (error) throw error;
      await loadPackages();
    } catch (error) {
      console.error('Failed to open package:', error);
    }
  };

  const toggleEmoji = (emoji: string) => {
    setSelectedEmojis(prev =>
      prev.includes(emoji)
        ? prev.filter(e => e !== emoji)
        : [...prev, emoji].slice(0, 5) // Max 5 emojis
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-swoono-dim">
        Loading care packages…
      </div>
    );
  }

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

      {showComposer ? (
        /* Package Composer */
        <div className="flex-1 px-5 pb-8">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl text-swoono-ink mb-2">Create Care Package</h3>
              <p className="text-swoono-dim">Send encouragement for when they need it most</p>
            </div>

            {/* Step 1: Message */}
            <div className="bg-black/40 rounded-xl p-6 border border-white/10 mb-6">
              <label className="block text-swoono-ink text-sm mb-3">Step 1: Write your message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="You've got this! Remember how amazing you are..."
                maxLength={300}
                className="w-full p-4 bg-white/10 border border-white/20 rounded-lg text-swoono-ink placeholder-swoono-dim/60 focus:outline-none focus:border-swoono-accent/50 resize-none"
                rows={4}
              />
              <div className="text-xs text-swoono-dim/60 mt-2">
                {message.length}/300 characters
              </div>
            </div>

            {/* Step 2: Emojis */}
            <div className="bg-black/40 rounded-xl p-6 border border-white/10 mb-6">
              <label className="block text-swoono-ink text-sm mb-3">Step 2: Add emojis (max 5)</label>
              <div className="grid grid-cols-6 gap-2 mb-3">
                {emojiOptions.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => toggleEmoji(emoji)}
                    className={`p-3 rounded-lg border-2 text-2xl transition-colors ${
                      selectedEmojis.includes(emoji)
                        ? 'border-swoono-accent bg-swoono-accent/20'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {selectedEmojis.map((emoji) => (
                  <span key={emoji} className="text-lg">{emoji}</span>
                ))}
              </div>
            </div>

            {/* Step 3: Delivery */}
            <div className="bg-black/40 rounded-xl p-6 border border-white/10 mb-6">
              <label className="block text-swoono-ink text-sm mb-3">Step 3: When to deliver</label>
              <div className="space-y-2">
                {[
                  { value: 'now', label: 'Send now', icon: '📦' },
                  { value: 'date', label: 'Specific date', icon: '📅' },
                  { value: 'random', label: 'Random surprise', icon: '🎲' },
                  { value: 'emergency', label: 'Emergency only', icon: '🆘' }
                ].map(({ value, label, icon }) => (
                  <button
                    key={value}
                    onClick={() => setDeliveryType(value as DeliveryType)}
                    disabled={!isPremium && value !== 'now'}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      deliveryType === value
                        ? 'border-swoono-accent bg-swoono-accent/20 text-swoono-ink'
                        : !isPremium && value !== 'now'
                          ? 'border-white/10 text-swoono-dim/40 cursor-not-allowed'
                          : 'border-white/20 hover:border-white/40 text-swoono-dim hover:text-swoono-ink'
                    }`}
                  >
                    <span className="mr-2">{icon}</span>
                    {label}
                    {!isPremium && value !== 'now' && <span className="ml-2 text-xs">🔒</span>}
                  </button>
                ))}
              </div>

              {deliveryType === 'date' && (
                <input
                  type="datetime-local"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full mt-3 p-3 bg-white/10 border border-white/20 rounded-lg text-swoono-ink focus:outline-none focus:border-swoono-accent/50"
                />
              )}
            </div>

            {/* Limits */}
            {!isPremium && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
                <div className="text-amber-400 text-sm font-semibold mb-1">
                  📦 {packagesThisMonth}/{monthlyLimit} packages this month
                </div>
                <div className="text-xs text-swoono-dim">
                  Upgrade for unlimited packages and scheduled delivery
                </div>
              </div>
            )}

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
                disabled={!message.trim() || (!isPremium && packagesThisMonth >= monthlyLimit)}
                className="flex-1 p-3 bg-swoono-accent text-black font-semibold rounded-lg hover:bg-swoono-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send Package
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Package List View */
        <div className="flex-1">
          {/* Emergency Button */}
          <div className="px-5 mb-6">
            <button
              onClick={() => {
                setDeliveryType('emergency');
                setShowComposer(true);
              }}
              className="w-full p-4 bg-red-500/20 border-2 border-red-400 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors"
            >
              <div className="text-2xl mb-1">🆘</div>
              <div className="font-semibold">Emergency Care Package</div>
              <div className="text-xs opacity-80">Send immediate love & support</div>
            </button>
          </div>

          <div className="px-5 pb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg text-swoono-ink">Your Packages</h3>
              <button
                onClick={() => setShowComposer(true)}
                disabled={!isPremium && packagesThisMonth >= monthlyLimit}
                className="bg-swoono-accent text-black px-4 py-2 rounded-lg font-semibold hover:bg-swoono-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create Package
              </button>
            </div>

            {packages.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📦</div>
                <h4 className="text-lg text-swoono-ink mb-2">No packages yet</h4>
                <p className="text-swoono-dim">Care packages from your partner will appear here</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`p-4 rounded-xl border transition-all ${
                      pkg.opened
                        ? 'bg-white/5 border-white/10'
                        : 'bg-gradient-to-r from-pink-500/20 to-rose-500/20 border-pink-400/40 hover:from-pink-500/30 hover:to-rose-500/30 cursor-pointer'
                    }`}
                    onClick={() => !pkg.opened && openPackage(pkg.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-1">
                        {pkg.emojis.map((emoji, index) => (
                          <span key={index} className="text-lg">{emoji}</span>
                        ))}
                      </div>
                      <div className="text-xs text-swoono-dim">
                        {new Date(pkg.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    {pkg.opened ? (
                      <div className="text-swoono-ink">{pkg.message}</div>
                    ) : (
                      <div className="text-center py-4">
                        <div className="text-3xl mb-2">🎁</div>
                        <div className="text-swoono-accent font-semibold">Tap to open package</div>
                      </div>
                    )}

                    {pkg.is_emergency && (
                      <div className="mt-2 text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
                        Emergency Package
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Sent Packages History */}
            {sentPackages.length > 0 && (
              <div className="mt-8">
                <h4 className="text-swoono-dim text-sm uppercase tracking-widest mb-4">Packages You've Sent</h4>
                <div className="space-y-3">
                  {sentPackages.slice(0, 3).map((pkg) => (
                    <div key={pkg.id} className="bg-black/20 rounded-lg p-3 border border-white/10">
                      <div className="flex justify-between items-start">
                        <div className="text-swoono-ink text-sm">{pkg.message.slice(0, 50)}...</div>
                        <div className="text-xs text-swoono-dim">
                          {pkg.opened ? '✅ Opened' : '📦 Sent'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}