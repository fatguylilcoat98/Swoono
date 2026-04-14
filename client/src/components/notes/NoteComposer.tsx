import { useState, FormEvent } from "react";
import {
  NOTE_COLORS,
  NOTE_COLOR_STYLES,
  type NoteColor,
} from "../../lib/types";
import { useRoomStore } from "../../state/roomStore";

export default function NoteComposer() {
  const [text, setText] = useState("");
  const [color, setColor] = useState<NoteColor>("pink");
  const sendNote = useRoomStore((s) => s.sendNote);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    sendNote(trimmed, color);
    setText("");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a note…"
        maxLength={280}
        rows={2}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-swoono-ink placeholder:text-swoono-dim/60 resize-none focus:outline-none focus:border-swoono-accent/60 focus:bg-white/10 transition-colors"
      />
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {NOTE_COLORS.map((c) => {
            const style = NOTE_COLOR_STYLES[c];
            const selected = c === color;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition-transform ${
                  selected
                    ? "ring-2 ring-offset-2 ring-offset-swoono-bg ring-white/40 scale-110"
                    : ""
                }`}
                style={{ backgroundColor: style.bg }}
                aria-label={`Color: ${c}`}
              />
            );
          })}
        </div>
        <button
          type="submit"
          disabled={!text.trim()}
          className="px-5 py-2 rounded-full bg-swoono-accent/20 border border-swoono-accent/50 text-swoono-ink text-xs uppercase tracking-widest hover:bg-swoono-accent/30 transition-colors disabled:opacity-40"
        >
          Send
        </button>
      </div>
      <p className="text-[10px] text-swoono-dim/70 text-right">
        {text.length}/280
      </p>
    </form>
  );
}
