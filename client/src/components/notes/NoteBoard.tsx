import { useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useRoomStore } from "../../state/roomStore";
import NoteCard from "./NoteCard";

export default function NoteBoard() {
  const notes = useRoomStore((s) => s.notes);
  const selfId = useRoomStore((s) => s.clientId);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [notes.length]);

  if (notes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-swoono-dim text-sm">
        No notes yet — send the first one below.
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2">
      <div className="flex flex-wrap gap-4 p-2 items-start">
        <AnimatePresence initial={false}>
          {notes.map((note, i) => (
            <NoteCard
              key={note.id}
              note={note}
              index={i}
              isSelf={note.authorClientId === selfId}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
