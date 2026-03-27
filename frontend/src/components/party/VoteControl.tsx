import { useState, useCallback, useEffect } from "react";
import { socket } from "../../lib/socket";
import type { Reaction } from "./Reactions";

interface VoteControlProps {
  partyId: string;
  trackId: string;
  participantId: string;
  currentVote: number | null;
  votesUsed: number;
  maxVotes: number;
  onReact?: (reaction: Omit<Reaction, "id">) => void;
  userName?: string;
}

export default function VoteControl({
  partyId,
  trackId,
  participantId,
  currentVote,
  votesUsed,
  maxVotes,
  onReact,
  userName = "you",
}: VoteControlProps) {
  const [voted, setVoted] = useState(currentVote === 1);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    setVoted(currentVote === 1);
  }, [currentVote]);

  const votesRemaining = maxVotes - votesUsed + (currentVote === 1 ? 1 : 0);
  const canVote = voted || votesRemaining > 0;

  const toggle = useCallback(() => {
    if (!voted && !canVote) return;
    const newValue = voted ? 0 : 1;
    setVoted(!voted);
    socket.emit("vote:cast", {
      partyId,
      trackId,
      participantId,
      value: newValue,
    });

    if (newValue === 1) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 600);
      if (onReact) {
        onReact({ user: userName, content: "vote", type: "vote" });
      }
    }
  }, [partyId, trackId, participantId, voted, canVote, onReact, userName]);

  return (
    <button
      onClick={toggle}
      disabled={!voted && !canVote}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300
        ${voted
          ? "bg-amber/15 border border-amber/30 text-amber"
          : canVote
            ? "bg-white/[0.04] border border-white/[0.08] text-warm-muted/50 hover:text-warm-muted/70 hover:border-white/[0.12]"
            : "bg-white/[0.02] border border-white/[0.04] text-warm-muted/20 cursor-not-allowed"
        }
      `}
      style={voted ? {
        boxShadow: animating
          ? "0 0 20px rgba(212, 165, 116, 0.3), 0 0 40px rgba(212, 165, 116, 0.1)"
          : "0 0 12px rgba(212, 165, 116, 0.1)",
        transition: "all 0.3s ease, box-shadow 0.6s ease",
      } : undefined}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill={voted ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transform: animating ? "scale(1.3)" : "scale(1)",
          transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
      <span className="text-[11px] font-medium tracking-wide">
        {voted ? "Voted" : canVote ? "Vote" : "No votes left"}
      </span>
    </button>
  );
}
