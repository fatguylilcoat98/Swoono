export type Peer = {
  clientId: string;
  name: string;
};

export type Note = {
  id: string;
  roomCode: string;
  authorClientId: string;
  authorName: string;
  text: string;
  color: string;
  createdAt: number;
};

export type JoinResult =
  | {
      ok: true;
      room: {
        code: string;
        peers: Peer[];
        notes: Note[];
      };
    }
  | { ok: false; error: string };

export type NoteColor = "yellow" | "pink" | "mint" | "lavender" | "peach";

export const NOTE_COLORS: NoteColor[] = [
  "yellow",
  "pink",
  "mint",
  "lavender",
  "peach",
];

export const NOTE_COLOR_STYLES: Record<NoteColor, { bg: string; ink: string }> =
  {
    yellow: { bg: "#fff6a8", ink: "#2a2100" },
    pink: { bg: "#ffc2d8", ink: "#330019" },
    mint: { bg: "#b6f2cf", ink: "#00261a" },
    lavender: { bg: "#d8c8ff", ink: "#1b0a38" },
    peach: { bg: "#ffcdb2", ink: "#2e1700" },
  };
