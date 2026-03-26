import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

interface RankedTrack {
  rank: number;
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  addedBy: string;
  totalScore: number;
  voteCount: number;
  reactionCount: number;
}

interface PartyOverProps {
  winner: RankedTrack | null;
  rankings: RankedTrack[];
}

export default function PartyOver({ winner, rankings }: PartyOverProps) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 bg-void flex flex-col items-center justify-center overflow-hidden overflow-y-auto py-8">
      {/* Back button */}
      <button
        onClick={() => navigate("/")}
        className="absolute top-4 left-3 sm:top-6 sm:left-6 z-20 flex items-center gap-2 text-warm-muted/40 hover:text-warm-muted/70 transition-colors duration-200"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span className="text-xs font-light tracking-wide">New session</span>
      </button>

      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, rgba(212,165,116,0.08) 0%, transparent 60%)",
        }}
      />

      {winner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center gap-6"
        >
          <p className="text-amber/50 text-[10px] font-light tracking-[0.4em] uppercase">
            Winner
          </p>

          {/* Trophy artwork */}
          <div className="relative">
            <div
              className="absolute -inset-20 rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(212,165,116,0.15) 0%, transparent 60%)",
                animation: "pulseGlow 3s ease-in-out infinite",
              }}
            />
            <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-xl overflow-hidden artwork-shadow">
              <img
                src={winner.albumArt}
                alt={winner.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="text-center">
            <h2 className="font-display text-2xl font-bold text-warm">
              {winner.title}
            </h2>
            <p className="text-warm-muted/50 text-xs font-light mt-1">
              {winner.artist}
            </p>
            <p className="text-amber/40 text-[10px] font-light mt-2">
              added by {winner.addedBy}
            </p>
            <div className="flex items-center justify-center gap-3 mt-1.5">
              <span className="text-warm-muted/30 text-[10px]">
                {winner.voteCount} {winner.voteCount === 1 ? "vote" : "votes"}
              </span>
              <span className="text-warm-muted/15">·</span>
              <span className="text-warm-muted/30 text-[10px]">
                {winner.reactionCount} {winner.reactionCount === 1 ? "reaction" : "reactions"}
              </span>
              <span className="text-warm-muted/15">·</span>
              <span className="text-warm-muted/30 text-[10px]">
                {winner.totalScore.toLocaleString()} pts
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Rankings */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="relative z-10 mt-6 sm:mt-10 w-full max-w-sm px-4"
      >
        <p className="text-warm-muted/30 text-[10px] font-light tracking-wider uppercase text-center mb-3">
          Final rankings
        </p>

        <div className="space-y-1">
          {rankings.slice(0, 5).map((track, i) => (
            <motion.div
              key={track.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + i * 0.1 }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg ${
                i === 0 ? "bg-amber/[0.08] border border-amber/15" : ""
              }`}
            >
              <span className="text-warm-muted/30 text-[11px] w-4 text-right tabular-nums">
                {track.rank}
              </span>
              <img
                src={track.albumArt}
                alt=""
                className="w-8 h-8 rounded object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-warm text-[13px] truncate">{track.title}</p>
                <p className="text-warm-muted/40 text-[10px] truncate">
                  {track.artist} · {track.addedBy}
                </p>
              </div>
              <span className="text-amber/40 text-[11px] font-medium tabular-nums">
                {track.totalScore.toLocaleString()}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
