import { motion } from "framer-motion";
import type { Note } from "../../lib/types";
import { NOTE_COLOR_STYLES, type NoteColor } from "../../lib/types";

type NoteCardProps = {
  note: Note;
  index: number;
  isSelf: boolean;
};

function resolveColor(color: string): NoteColor {
  if (color in NOTE_COLOR_STYLES) return color as NoteColor;
  return "yellow";
}

// Stable per-note rotation so notes keep their splash angle across re-renders.
function rotationFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  const normalized = ((h % 200) - 100) / 100;
  return normalized * 4;
}

export default function NoteCard({ note, index, isSelf }: NoteCardProps) {
  const color = resolveColor(note.color);
  const style = NOTE_COLOR_STYLES[color];
  const rot = rotationFor(note.id);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.4, rotate: rot - 12, y: -30 }}
      animate={{ opacity: 1, scale: 1, rotate: rot, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, rotate: rot + 8 }}
      transition={{
        type: "spring",
        stiffness: 420,
        damping: 22,
        delay: Math.min(index * 0.02, 0.2),
      }}
      className="relative p-4 rounded-md shadow-note w-full max-w-[220px]"
      style={{ backgroundColor: style.bg, color: style.ink }}
    >
      <p className="text-sm leading-snug whitespace-pre-wrap break-words font-medium">
        {note.text}
      </p>
      <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-wider opacity-75">
        <span>{isSelf ? "You" : note.authorName}</span>
        <span>
          {new Date(note.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </motion.div>
  );
}
