import { useState, useRef, useCallback } from "react";
import type { Reaction } from "./Reactions";

interface ReactionInputProps {
  onReact: (reaction: Omit<Reaction, "id">) => void;
  userName?: string;
}

const QUICK_REACTIONS = [
  {
    id: "fire",
    label: "fire",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.532-1.056-3.94-2-5-1.786 3-2.791 3-4 2z" />
      </svg>
    ),
  },
  {
    id: "heart",
    label: "heart",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    id: "sparkle",
    label: "sparkle",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
      </svg>
    ),
  },
  {
    id: "clap",
    label: "clap",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 11l4.08-9.18a1 1 0 0 1 1.84.04L17 11" />
        <path d="M17 11h1a3 3 0 0 1 3 3v2a8 8 0 0 1-8 8h-2a8 8 0 0 1-7.29-4.73" />
        <path d="M3.28 13.72A3 3 0 0 1 7 11" />
      </svg>
    ),
  },
  {
    id: "wow",
    label: "wow",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none" />
        <ellipse cx="12" cy="15.5" rx="2" ry="2.5" />
      </svg>
    ),
  },
];

export default function ReactionInput({ onReact, userName }: ReactionInputProps) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const send = useCallback(
    (content: string, type: "emoji" | "text") => {
      if (!content.trim()) return;
      onReact({ user: userName || "anon", content: content.trim(), type });
      setValue("");

      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setActive(false);
        inputRef.current?.blur();
      }, 600);
    },
    [onReact, userName]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      send(value, "text");
    }
  };

  const handleReactionTap = (label: string) => {
    send(label, "emoji");
  };

  const handleFocus = () => {
    setActive(true);
    clearTimeout(timeoutRef.current);
  };

  const handleBlur = () => {
    timeoutRef.current = setTimeout(() => {
      if (!value.trim()) {
        setActive(false);
      }
    }, 200);
  };

  return (
    <div className="absolute bottom-5 left-3 sm:bottom-8 sm:left-8 z-20">
      <div
        className={`
          flex items-center gap-3 transition-all duration-700 ease-out
          ${active ? "opacity-80" : "opacity-[0.45] hover:opacity-[0.6]"}
        `}
      >
        {/* Quick icon reactions */}
        <div
          className={`
            flex items-center transition-all duration-500 ease-out overflow-hidden
            ${active ? "gap-1.5 max-w-[200px] opacity-100" : "gap-1 max-w-[60px] opacity-100"}
          `}
        >
          {QUICK_REACTIONS.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleReactionTap(r.label)}
              className={`
                shrink-0 w-8 h-8 flex items-center justify-center rounded-full
                text-warm-muted/50 transition-all duration-300
                ${active
                  ? "hover:bg-white/[0.06] hover:text-warm-muted/80 hover:scale-110"
                  : i < 2
                    ? ""
                    : "opacity-0 w-0 pointer-events-none"
                }
              `}
              style={{
                transitionDelay: active ? `${i * 40}ms` : "0ms",
              }}
            >
              {r.icon}
            </button>
          ))}
        </div>

        {/* Text whisper input */}
        <form onSubmit={handleSubmit} className="relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={active ? "say something..." : ""}
            maxLength={60}
            className={`
              bg-transparent border-0 outline-none
              text-warm/50 placeholder:text-warm/20
              text-xs font-light tracking-wide
              transition-all duration-500 ease-out
              ${active
                ? "w-36 opacity-100 border-b border-warm/10 pb-px"
                : "w-0 opacity-0 absolute pointer-events-none"
              }
            `}
          />
          {/* Dormant hint */}
          {!active && (
            <button
              type="button"
              onClick={() => {
                setActive(true);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="text-[13px] text-warm/35 font-light tracking-wide hover:text-warm/50 transition-colors duration-500 cursor-text whitespace-nowrap"
            >
              Add a thought...
            </button>
          )}
        </form>
      </div>

    </div>
  );
}
