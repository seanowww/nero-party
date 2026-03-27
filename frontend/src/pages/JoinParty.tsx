import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { joinParty, rejoinParty, type JoinResult } from "../lib/api";

type View = "form" | "welcome-back";

export default function JoinParty() {
  const navigate = useNavigate();
  const { code: urlCode } = useParams<{ code?: string }>();

  const [code, setCode] = useState(urlCode || "");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("form");
  const [returningData, setReturningData] = useState<JoinResult | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !displayName.trim()) return;

    setLoading(true);
    setError("");

    try {
      const result = await joinParty(
        code.trim().toUpperCase(),
        displayName.trim()
      );

      if (result.returning) {
        // Name is taken — ask if they're the returning user
        setReturningData(result);
        setView("welcome-back");
        setLoading(false);
        return;
      }

      // New user — go straight to room
      localStorage.setItem(
        `nero-participant-${result.partyId}`,
        result.participantId
      );
      navigate(`/party/${result.partyId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to join party"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRejoin = async () => {
    if (!returningData) return;
    setLoading(true);

    try {
      const result = await rejoinParty(
        code.trim().toUpperCase(),
        returningData.participantId
      );

      localStorage.setItem(
        `nero-participant-${result.partyId}`,
        result.participantId
      );
      navigate(`/party/${result.partyId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to rejoin"
      );
      setLoading(false);
    }
  };

  const handleNotMe = () => {
    setView("form");
    setReturningData(null);
    setDisplayName("");
    setError("Try a different name");
  };

  return (
    <div className="fixed inset-0 bg-void flex items-center justify-center">
      {/* Background grain */}
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />

      <div className="relative z-10 w-full max-w-sm mx-6 sm:mx-auto">
        {/* Logo */}
        <div className="text-center mb-10 fade-in">
          <h1 className="font-display text-3xl font-bold text-warm tracking-tight">
            nero
          </h1>
          <p className="text-warm-muted/40 text-xs font-light mt-1 tracking-widest uppercase">
            join a party
          </p>
        </div>

        <AnimatePresence mode="wait">
          {view === "form" && (
            <motion.form
              key="join-form"
              onSubmit={handleJoin}
              className="space-y-5"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {!urlCode && (
                <div>
                  <label className="block text-warm-muted/50 text-[10px] font-light tracking-wider uppercase mb-2">
                    Party code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    maxLength={6}
                    className="w-full bg-surface border border-white/[0.06] rounded-lg px-4 py-3 text-warm text-sm font-medium tracking-[0.3em] text-center placeholder:text-warm-muted/25 placeholder:tracking-[0.3em] outline-none focus:border-amber/30 transition-colors uppercase"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-warm-muted/50 text-[10px] font-light tracking-wider uppercase mb-2">
                  Your name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-surface border border-white/[0.06] rounded-lg px-4 py-3 text-warm text-sm font-light placeholder:text-warm-muted/25 outline-none focus:border-amber/30 transition-colors"
                  required
                />
              </div>

              {error && (
                <motion.p
                  className="text-red-400/70 text-xs font-light"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={loading || !code.trim() || !displayName.trim()}
                className="w-full py-3 rounded-lg bg-warm text-void text-sm font-semibold hover:bg-warm/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Joining..." : "Join the party"}
              </button>
            </motion.form>
          )}

          {view === "welcome-back" && returningData && (
            <motion.div
              key="welcome-back"
              className="space-y-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              {/* Avatar + name card */}
              <div className="flex flex-col items-center gap-4">
                <motion.div
                  className="relative"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                    delay: 0.1,
                  }}
                >
                  {/* Glow ring behind avatar */}
                  <div
                    className="absolute -inset-3 rounded-full opacity-20 blur-xl"
                    style={{
                      background: returningData.participant.color,
                    }}
                  />
                  <div
                    className="relative w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-void"
                    style={{
                      background: returningData.participant.color,
                    }}
                  >
                    {returningData.participant.displayName
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                </motion.div>

                <motion.div
                  className="text-center"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <p className="text-warm-muted/50 text-[10px] font-light tracking-wider uppercase mb-1.5">
                    Welcome back?
                  </p>
                  <p className="text-warm text-lg font-semibold tracking-tight">
                    {returningData.participant.displayName}
                  </p>
                  <p className="text-warm-muted/40 text-xs font-light mt-1">
                    This name is already in the party
                  </p>
                </motion.div>
              </div>

              {/* Action buttons */}
              <motion.div
                className="space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                <button
                  onClick={handleConfirmRejoin}
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-warm text-void text-sm font-semibold hover:bg-warm/90 transition-colors disabled:opacity-40"
                >
                  {loading ? "Rejoining..." : "That's me — rejoin"}
                </button>

                <button
                  onClick={handleNotMe}
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-surface border border-white/[0.06] text-warm-muted text-sm font-light hover:border-white/[0.12] hover:text-warm transition-colors disabled:opacity-40"
                >
                  Not me — pick a different name
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="text-center mt-6 fade-in"
          style={{ animationDelay: "0.3s" }}
        >
          <a
            href="/"
            className="text-warm-muted/30 text-[11px] font-light hover:text-warm-muted/50 transition-colors"
          >
            Or start your own party
          </a>
        </div>
      </div>
    </div>
  );
}
