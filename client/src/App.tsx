import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import Landing from "./components/landing/Landing";
import RoomEntry from "./components/room/RoomEntry";
import RoomShell from "./components/room/RoomShell";
import ModeSelector from "./components/theme/ModeSelector";
import ThemeProvider from "./components/theme/ThemeProvider";
import EffectOverlay from "./components/effects/EffectOverlay";
import { useRoomStore } from "./state/roomStore";
import { useThemeStore } from "./state/themeStore";

type Stage = "mode" | "landing" | "entry" | "room";

export default function App() {
  const hasChosen = useThemeStore((s) => s.hasChosen);
  const [stage, setStage] = useState<Stage>(hasChosen ? "landing" : "mode");
  const code = useRoomStore((s) => s.code);
  const leave = useRoomStore((s) => s.leave);

  const handleLeave = () => {
    leave();
    setStage("landing");
  };

  return (
    <ThemeProvider>
      <div className="min-h-dvh bg-swoono-bg text-swoono-ink font-sans antialiased overflow-hidden">
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
      </div>
    </ThemeProvider>
  );
}
