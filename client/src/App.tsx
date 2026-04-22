import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import Landing from "./components/landing/Landing";
import RoomEntry from "./components/room/RoomEntry";
import RoomShell from "./components/room/RoomShell";
import ModeSelector from "./components/theme/ModeSelector";
import ThemeProvider from "./components/theme/ThemeProvider";
import EffectOverlay from "./components/effects/EffectOverlay";
import InstallPrompt from "./components/ui/InstallPrompt";
import AdminPanel from "./components/admin/AdminPanel";
import { useRoomStore } from "./state/roomStore";
import { useThemeStore } from "./state/themeStore";
import { getSupabase } from "./lib/supabase";
import { getClientId } from "./lib/clientId";

type Stage = "mode" | "landing" | "entry" | "room";

export default function App() {
  const hasChosen = useThemeStore((s) => s.hasChosen);
  const [stage, setStage] = useState<Stage>(hasChosen ? "landing" : "mode");
  const code = useRoomStore((s) => s.code);
  const leave = useRoomStore((s) => s.leave);
  const join = useRoomStore((s) => s.join);

  // Prevent pull-to-refresh on mobile browsers
  useEffect(() => {
    document.body.style.overscrollBehavior = 'none';

    let lastY = 0;
    const preventPullToRefresh = (e: TouchEvent) => {
      const y = e.touches[0].clientY;
      if (window.scrollY === 0 && y > lastY) {
        e.preventDefault();
      }
      lastY = y;
    };

    const handleTouchStart = (e: TouchEvent) => {
      lastY = e.touches[0].clientY;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', preventPullToRefresh, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', preventPullToRefresh);
    };
  }, []);

  // Auth persistence listener with auto-room loading
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        console.log('Session active:', session.user.id);

        // Auto-load user's existing room
        const clientId = getClientId(); // This will be user_${session.user.id}

        try {
          const { data: existingRooms } = await supabase
            .from('rooms')
            .select('code')
            .contains('owner_client_ids', [clientId])
            .order('last_activity_at', { ascending: false })
            .limit(1);

          if (existingRooms && existingRooms.length > 0) {
            // Auto-join their existing room
            const roomCode = existingRooms[0].code;
            console.log('Auto-joining existing room:', roomCode);

            // Get display name from localStorage or use default
            const displayName = localStorage.getItem("swoono:displayName") || "You";

            const joinResult = await join(roomCode, displayName);
            if (joinResult) {
              setStage("room");
            }
          }
        } catch (error) {
          console.warn('Error loading existing room:', error);
          // Continue to normal room entry flow
        }
      }
      if (event === 'SIGNED_OUT') {
        console.log('User signed out');
        // Return to landing if they sign out
        setStage("landing");
      }
    });

    return () => subscription?.unsubscribe();
  }, [join]);

  const handleLeave = () => {
    leave();
    setStage("landing");
  };

  return (
    <ThemeProvider>
      <div className="min-h-dvh bg-swoono-bg text-swoono-ink font-sans antialiased">
        <AnimatePresence mode="wait">
          {stage === "mode" && (
            <ModeSelector key="mode" onDone={() => setStage("landing")} />
          )}
          {stage === "landing" && (
            <Landing key="landing" onEnter={() => setStage("entry")} />
          )}
          {stage === "entry" && (
            <RoomEntry
              key="entry"
              onJoined={() => setStage("room")}
              onBack={() => setStage("landing")}
            />
          )}
          {stage === "room" && code && (
            <RoomShell key="room" onLeave={handleLeave} />
          )}
        </AnimatePresence>
        <EffectOverlay />
        <InstallPrompt />
        <AdminPanel />
        <VersionBadge />
      </div>
    </ThemeProvider>
  );
}

function VersionBadge() {
  return (
    <div
      className="fixed bottom-1.5 right-2 z-50 text-[10px] font-mono text-swoono-dim/60 pointer-events-none select-none tracking-wider"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      v{__APP_VERSION__}
    </div>
  );
}
