import { useState, useEffect, useRef } from "react";

interface TimeWarningProps {
  partyCreatedAt: number | null;
  timeLimitMin: number | null;
}

type WarningLevel = "five-min" | "one-min" | null;

const MESSAGES: Record<string, { text: string; sub: string }> = {
  "five-min": { text: "5 minutes left", sub: "Make your last picks count" },
  "one-min": { text: "Last minute", sub: "The party is wrapping up" },
};

export default function TimeWarning({ partyCreatedAt, timeLimitMin }: TimeWarningProps) {
  const [visible, setVisible] = useState(false);
  const [level, setLevel] = useState<WarningLevel>(null);
  const shownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!partyCreatedAt || !timeLimitMin) return;

    const endTime = partyCreatedAt + timeLimitMin * 60 * 1000;

    const check = () => {
      const remaining = endTime - Date.now();
      const remainingSec = remaining / 1000;

      if (remainingSec <= 60 && !shownRef.current.has("one-min")) {
        shownRef.current.add("one-min");
        showWarning("one-min");
      } else if (remainingSec <= 300 && !shownRef.current.has("five-min")) {
        shownRef.current.add("five-min");
        showWarning("five-min");
      }
    };

    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [partyCreatedAt, timeLimitMin]);

  function showWarning(newLevel: WarningLevel) {
    setLevel(newLevel);
    setVisible(true);
    setTimeout(() => setVisible(false), 5000);
  }

  if (!level) return null;

  const msg = MESSAGES[level];

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-100%)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}
    >
      <div
        className="w-full flex items-center justify-center gap-2 py-2"
        style={{
          background: level === "one-min"
            ? "rgba(239, 68, 68, 0.08)"
            : "rgba(212, 165, 116, 0.06)",
          borderBottom: `1px solid ${level === "one-min" ? "rgba(239, 68, 68, 0.12)" : "rgba(212, 165, 116, 0.10)"}`,
          backdropFilter: "blur(20px)",
        }}
      >
        <span
          className={`text-[11px] font-medium tracking-wider uppercase ${
            level === "one-min" ? "text-red-400/80" : "text-amber/70"
          }`}
        >
          {msg.text}
        </span>
        <span className="text-[10px] text-warm-muted/40 font-light tracking-wide">
          {msg.sub}
        </span>
      </div>
    </div>
  );
}
