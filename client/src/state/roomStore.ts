import { create } from "zustand";
import type { ActiveGame, Note, Peer, JoinResult } from "../lib/types";
import { getSocket, CLIENT_ID } from "../lib/socket";
import {
  triggerEffect,
  type EffectPayload,
} from "../lib/registries/effectRegistry";

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

  // actions
  setDisplayName: (name: string) => void;
  join: (code: string, name: string) => Promise<boolean>;
  leave: () => void;
  sendNote: (text: string, color: string) => void;
  startGame: (gameId: string) => void;
  makeMove: (cellIndex: number) => void;
  dropColumn: (column: number) => void;
  guessLetter: (letter: string) => void;
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

    submitBattleshipPlacement: (ships) => {
      socket.emit("game:move", { action: "place", ships });
    },

    fireBattleshipShot: (x, y) => {
      socket.emit("game:move", { action: "fire", x, y });
    },

    pushLocation: (lat, lng, accuracyM) => {
      socket.emit("location:update", { lat, lng, accuracyM });
    },

    exitGame: () => {
      socket.emit("game:exit");
    },
  };
});
