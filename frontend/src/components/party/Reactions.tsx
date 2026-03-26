import { useState, useEffect, useRef } from "react";

export interface Reaction {
  id: string;
  user: string;
  content: string;
  type: "emoji" | "text" | "vote";
}

interface ReactionsProps {
  reactions: Reaction[];
}

interface LiveReaction extends Reaction {
  uid: string;
  born: number;
  x: number; // percentage left
  y: number; // percentage top
}

const LIFECYCLE_MS = 5400;

/** Generate a random position biased toward edges (avoids center album area) */
function randomEdgePosition(): { x: number; y: number } {
  // Pick a random spot, but push away from center (35-65% zone)
  let x = Math.random() * 100;
  let y = Math.random() * 100;

  // If too close to center horizontally AND vertically, push to an edge
  if (x > 25 && x < 75 && y > 20 && y < 70) {
    // Randomly push to left or right edge
    if (Math.random() > 0.5) {
      x = Math.random() > 0.5 ? Math.random() * 20 : 80 + Math.random() * 18;
    } else {
      y = Math.random() > 0.5 ? Math.random() * 18 : 72 + Math.random() * 20;
    }
  }

  return { x, y };
}

/** Map reaction labels to grey SVG icons */
function ReactionIcon({ content }: { content: string }) {
  const cls = "w-4 h-4 text-warm-muted";
  switch (content) {
    case "fire":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.532-1.056-3.94-2-5-1.786 3-2.791 3-4 2z" />
        </svg>
      );
    case "heart":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      );
    case "sparkle":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
        </svg>
      );
    case "clap":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 11l4.08-9.18a1 1 0 0 1 1.84.04L17 11" />
          <path d="M17 11h1a3 3 0 0 1 3 3v2a8 8 0 0 1-8 8h-2a8 8 0 0 1-7.29-4.73" />
          <path d="M3.28 13.72A3 3 0 0 1 7 11" />
        </svg>
      );
    case "wow":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none" />
          <ellipse cx="12" cy="15.5" rx="2" ry="2.5" />
        </svg>
      );
    default:
      return null;
  }
}

export default function Reactions({ reactions }: ReactionsProps) {
  const [live, setLive] = useState<LiveReaction[]>([]);
  const uidRef = useRef(0);
  const prevLenRef = useRef(0);

  // Show each new reaction as it arrives
  useEffect(() => {
    if (reactions.length <= prevLenRef.current) {
      prevLenRef.current = reactions.length;
      return;
    }

    const newReactions = reactions.slice(prevLenRef.current);
    prevLenRef.current = reactions.length;

    const newLive: LiveReaction[] = newReactions.map((r) => {
      const pos = randomEdgePosition();
      return {
        ...r,
        uid: `live-${uidRef.current++}`,
        born: Date.now(),
        x: pos.x,
        y: pos.y,
      };
    });

    setLive((prev) => [...prev, ...newLive].slice(-10));
  }, [reactions]);

  // Reap expired
  useEffect(() => {
    const reap = setInterval(() => {
      setLive((prev) => prev.filter((r) => Date.now() - r.born < LIFECYCLE_MS));
    }, 500);
    return () => clearInterval(reap);
  }, []);

  return (
    <div className="fixed inset-0 z-20 pointer-events-none overflow-hidden">
      {live.map((r) => (
        <div
          key={r.uid}
          className="absolute whitespace-nowrap"
          style={{
            left: `${r.x}%`,
            top: `${r.y}%`,
            animation: `ambientDrift ${LIFECYCLE_MS}ms ease-out forwards`,
            willChange: "transform, opacity",
          }}
        >
          {r.type === "vote" ? (
            <div
              className="flex items-center gap-2.5 rounded-full px-3.5 py-1.5 bg-amber/10 border border-amber/20"
              style={{ animation: "reactionGlow 1.2s ease-out forwards" }}
            >
              <svg className="w-4 h-4 text-amber" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span className="text-amber/90 text-[13px] font-medium tracking-wide">
                {r.user} voted
              </span>
            </div>
          ) : r.type === "text" ? (
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-warm-muted/60 text-[10px] font-light tracking-wider">
                {r.user}
              </span>
              <span
                className="bg-white/[0.08] border border-white/[0.1] rounded-lg rounded-tl-none px-2.5 py-1 text-warm/70 text-[12px] font-light max-w-[180px] truncate"
                style={{ animation: "reactionGlow 1.2s ease-out forwards" }}
              >
                {r.content}
              </span>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 rounded-full px-2 py-1"
              style={{ animation: "reactionGlow 1.2s ease-out forwards" }}
            >
              <ReactionIcon content={r.content} />
              <span className="text-warm-muted/60 text-[12px] font-light tracking-wider">
                {r.user}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
