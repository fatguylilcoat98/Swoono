import { create } from "zustand";
import type { ActiveGame, GameRecord, Note, Peer, JoinResult } from "../lib/types";
import { getSocket, CLIENT_ID } from "../lib/socket";
import {
  triggerEffect,
  type EffectPayload,
} from "../lib/registries/effectRegistry";
import { usePointsStore } from "./pointsStore";

type RoomState = {
  // identity
  clientId: string;
  displayName: string;

  // room
  code: string | null;
  connected: boolean;
  joining: boolean;
  joinError: string | null;
  peers: Peer[];
  notes: Note[];

  // active game (authoritative server state)
  activeGame: ActiveGame | null;

  // distance apart (meters, computed on server)
  distanceMeters: number | null;
  distanceUpdatedAt: number | null;

  // recent game history — drives the Leaderboard "Recent games" list
  records: GameRecord[];

  // points tracking for all peers
  peerPoints: Record<string, number>;

  // actions
  setDisplayName: (name: string) => void;
  join: (code: string, name: string) => Promise<boolean>;
  leave: () => void;
  sendNote: (text: string, color: string) => void;
  resetRoom: (force?: boolean) => Promise<boolean>;
  startGame: (gameId: string) => void;
  makeMove: (cellIndex: number) => void;
  dropColumn: (column: number) => void;
  guessLetter: (letter: string) => void;
  guessWord: (word: string) => void;
  submitBattleshipPlacement: (
    ships: {
      name: string;
      len: number;
      x: number;
      y: number;
      vertical: boolean;
    }[],
  ) => void;
  fireBattleshipShot: (x: number, y: number) => void;
  makeDrawingMove: (action: "add-stroke" | "ready-for-reveal" | "undo" | "clear", data?: any) => void;
  dropNeonStackerBlock: (x: number) => void;
  submitLoveTriviaAnswer: (choice: number) => void;
  submitLoveTriviaSetupPrediction: (qIdx: number, choice: number) => void;
  pickPrompt: (promptType: "truth" | "dare") => void;
  completePrompt: () => void;
  skipPrompt: () => void;
  markLovingQuestDone: () => void;
  submitWordChainWord: (word: string) => void;
  forfeitWordChain: () => void;
  submitTriviaAnswer: (choice: number) => void;
  pushLocation: (lat: number, lng: number, accuracyM?: number) => void;
  exitGame: () => void;
};

export const useRoomStore = create<RoomState>((set, get) => {
  const socket = getSocket();

  socket.on("connect", () => {
    set({ connected: true });
    // If we had a joined code and just reconnected, silently rejoin.
    const { code, displayName } = get();
    if (code) {
      socket.emit(
        "join",
        { code, name: displayName, clientId: CLIENT_ID },
        () => {
          /* silent rejoin ack */
        },
      );
    }
  });

  socket.on("disconnect", () => {
    set({ connected: false });
  });

  socket.on("presence", ({ peers }: { peers: Peer[] }) => {
    set({ peers });
  });

  socket.on("note:new", (note: Note) => {
    set((s) => ({ notes: [...s.notes, note] }));
  });

  socket.on("game:update", ({ game }: { game: ActiveGame | null }) => {
    set({ activeGame: game });
  });

  // A peer sent us a reward effect — play it locally on our screen.
  socket.on("effect:receive", (payload: EffectPayload) => {
    triggerEffect(payload);
  });

  socket.on(
    "distance:update",
    ({ meters, updatedAt }: { meters: number; updatedAt: number }) => {
      set({ distanceMeters: meters, distanceUpdatedAt: updatedAt });
    },
  );

  // Recent game history from the server
  socket.on("records:update", ({ records }: { records: GameRecord[] }) => {
    set({ records: Array.isArray(records) ? records : [] });
  });

  // The other peer hit "Reset Room" — we get ejected and dropped to
  // the landing screen with a message.
  socket.on("room:reset:forced", () => {
    set({
      code: null,
      peers: [],
      notes: [],
      activeGame: null,
      distanceMeters: null,
      distanceUpdatedAt: null,
      joinError: "The other person reset this room. Start fresh.",
      peerPoints: {},
    });
  });

  // Listen for points sync from server
  socket.on("points:sync", ({ clientId, points }: { clientId: string; points: number }) => {
    // Update peer points tracking for all clients
    set((s) => ({
      peerPoints: { ...s.peerPoints, [clientId]: points }
    }));

    // Also sync to the points store if it's our client ID
    if (clientId === CLIENT_ID) {
      usePointsStore.getState().syncFromServer(points);
    }
  });

  return {
    clientId: CLIENT_ID,
    displayName: "",
    code: null,
    connected: socket.connected,
    joining: false,
    joinError: null,
    peers: [],
    notes: [],
    activeGame: null,
    distanceMeters: null,
    distanceUpdatedAt: null,
    records: [],
    peerPoints: {},

    setDisplayName: (name) => set({ displayName: name }),

    join: async (code, name) => {
      set({ joining: true, joinError: null });
      const trimmed = code.trim().toUpperCase();
      const displayName = name.trim().slice(0, 32) || "Anonymous";

      return new Promise<boolean>((resolve) => {
        socket.emit(
          "join",
          { code: trimmed, name: displayName, clientId: CLIENT_ID },
          (res: JoinResult) => {
            if (res?.ok) {
              set({
                code: res.room.code,
                peers: res.room.peers,
                notes: res.room.notes,
                records: res.room.records || [],
                displayName,
                joining: false,
                joinError: null,
              });
              resolve(true);
            } else {
              set({
                joining: false,
                joinError: res?.error || "Could not join room",
              });
              resolve(false);
            }
          },
        );
      });
    },

    leave: () => {
      // Soft leave — keep the socket, drop local room state.
      set({
        code: null,
        peers: [],
        notes: [],
        activeGame: null,
        distanceMeters: null,
        distanceUpdatedAt: null,
        joinError: null,
        peerPoints: {},
        records: [],
      });
    },

    resetRoom: async (force = false) => {
      const currentCode = get().code;
      if (!currentCode) return false;
      return new Promise<boolean>((resolve) => {
        socket.emit(
          "room:reset",
          { code: currentCode, clientId: CLIENT_ID, force },
          (res: { ok: boolean; error?: string }) => {
            if (res?.ok) {
              // Drop everything locally — it's gone server-side now.
              set({
                code: null,
                peers: [],
                notes: [],
                activeGame: null,
                distanceMeters: null,
                distanceUpdatedAt: null,
                joinError: null,
                peerPoints: {},
              });
              resolve(true);
            } else {
              set({ joinError: res?.error || "Could not reset room" });
              resolve(false);
            }
          },
        );
      });
    },

    sendNote: (text, color) => {
      socket.emit("note:create", { text, color });
    },

    startGame: (gameId) => {
      // Don't start if a game is already active in the room.
      if (get().activeGame) return;
      socket.emit("game:start", { gameId });
    },

    makeMove: (cellIndex) => {
      socket.emit("game:move", { cellIndex });
    },

    dropColumn: (column) => {
      socket.emit("game:move", { column });
    },

    guessLetter: (letter) => {
      socket.emit("game:move", { letter });
    },

    guessWord: (word) => {
      socket.emit("game:move", { word });
    },

    submitBattleshipPlacement: (ships) => {
      socket.emit("game:move", { action: "place", ships });
    },

    fireBattleshipShot: (x, y) => {
      socket.emit("game:move", { action: "fire", x, y });
    },

    makeDrawingMove: (action, data) => {
      if (action === "add-stroke") {
        socket.emit("game:move", { action: "add-stroke", stroke: data });
      } else if (action === "ready-for-reveal") {
        socket.emit("game:move", { action: "ready-for-reveal" });
      } else if (action === "undo") {
        socket.emit("game:move", { action: "undo" });
      } else if (action === "clear") {
        socket.emit("game:move", { action: "clear" });
      }
    },

    dropNeonStackerBlock: (x) => {
      socket.emit("game:move", { action: "drop", x });
    },

    submitLoveTriviaAnswer: (choice) => {
      socket.emit("game:move", { action: "answer", choice });
    },

    submitLoveTriviaSetupPrediction: (qIdx, choice) => {
      socket.emit("game:move", { action: "setupPredict", qIdx, choice });
    },

    pickPrompt: (promptType: "truth" | "dare") => {
      socket.emit("game:move", { action: "pickPrompt", promptType });
    },

    completePrompt: () => {
      socket.emit("game:move", { action: "completePrompt" });
    },

    skipPrompt: () => {
      socket.emit("game:move", { action: "skipPrompt" });
    },

    markLovingQuestDone: () => {
      socket.emit("game:move", { action: "markDone" });
    },

    submitWordChainWord: (word: string) => {
      socket.emit("game:move", { action: "submitWord", word });
    },

    forfeitWordChain: () => {
      socket.emit("game:move", { action: "forfeit" });
    },

    submitTriviaAnswer: (choice: number) => {
      socket.emit("game:move", { action: "answer", choice });
    },

    pushLocation: (lat, lng, accuracyM) => {
      socket.emit("location:update", { lat, lng, accuracyM });
    },

    exitGame: () => {
      socket.emit("game:exit");
    },
  };
});
