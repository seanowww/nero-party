import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { joinParty } from "../lib/api";

export default function JoinParty() {
  const navigate = useNavigate();
  const { code: urlCode } = useParams<{ code?: string }>();

  const [code, setCode] = useState(urlCode || "");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !displayName.trim()) return;

    setLoading(true);
    setError("");

    try {
      const result = await joinParty(code.trim().toUpperCase(), displayName.trim());

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

        <form onSubmit={handleJoin} className="space-y-5 fade-in-up">
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
            <p className="text-red-400/70 text-xs font-light">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim() || !displayName.trim()}
            className="w-full py-3 rounded-lg bg-warm text-void text-sm font-semibold hover:bg-warm/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Joining..." : "Join the party"}
          </button>
        </form>

        <div className="text-center mt-6 fade-in" style={{ animationDelay: "0.3s" }}>
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
