import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createParty } from "../lib/api";

export default function CreateParty() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [hostName, setHostName] = useState("");
  const [maxSongs, setMaxSongs] = useState<number | "">(20);
  const [maxVotesPerUser, setMaxVotesPerUser] = useState<number | "">(5);
  const [timeLimitMin, setTimeLimitMin] = useState<number | "">(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !hostName.trim()) return;
    const finalMaxSongs = Math.min(50, Math.max(2, Number(maxSongs) || 20));

    setLoading(true);
    setError("");

    try {
      const finalMaxVotes = Math.min(50, Math.max(1, Number(maxVotesPerUser) || 5));
      const result = await createParty({
        name: name.trim(),
        hostName: hostName.trim(),
        maxSongs: finalMaxSongs,
        maxVotesPerUser: finalMaxVotes,
        timeLimitMin: timeLimitMin || undefined,
      });

      // Store participant ID for the party
      localStorage.setItem(
        `nero-participant-${result.id}`,
        result.participantId
      );

      navigate(`/party/${result.id}`);
    } catch {
      setError("Failed to create party. Is the server running?");
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
            listening party
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-5 fade-in-up">
          <div>
            <label className="block text-warm-muted/50 text-[10px] font-light tracking-wider uppercase mb-2">
              Party name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friday Night Vibes"
              className="w-full bg-surface border border-white/[0.06] rounded-lg px-4 py-3 text-warm text-sm font-light placeholder:text-warm-muted/25 outline-none focus:border-amber/30 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-warm-muted/50 text-[10px] font-light tracking-wider uppercase mb-2">
              Your name
            </label>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Enter your name"
              className="w-full bg-surface border border-white/[0.06] rounded-lg px-4 py-3 text-warm text-sm font-light placeholder:text-warm-muted/25 outline-none focus:border-amber/30 transition-colors"
              required
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-warm-muted/50 text-[10px] font-light tracking-wider uppercase mb-2">
                Max songs
              </label>
              <input
                type="number"
                value={maxSongs}
                onChange={(e) =>
                  setMaxSongs(e.target.value ? Number(e.target.value) : "")
                }
                min={2}
                max={50}
                className="w-full bg-surface border border-white/[0.06] rounded-lg px-4 py-3 text-warm text-sm font-light outline-none focus:border-amber/30 transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="block text-warm-muted/50 text-[10px] font-light tracking-wider uppercase mb-2">
                Votes per user
              </label>
              <input
                type="number"
                value={maxVotesPerUser}
                onChange={(e) =>
                  setMaxVotesPerUser(e.target.value ? Number(e.target.value) : "")
                }
                min={1}
                max={50}
                className="w-full bg-surface border border-white/[0.06] rounded-lg px-4 py-3 text-warm text-sm font-light outline-none focus:border-amber/30 transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="block text-warm-muted/50 text-[10px] font-light tracking-wider uppercase mb-2">
                Time (min)
              </label>
              <input
                type="number"
                value={timeLimitMin}
                onChange={(e) =>
                  setTimeLimitMin(e.target.value ? Number(e.target.value) : "")
                }
                min={5}
                max={180}
                placeholder="None"
                className="w-full bg-surface border border-white/[0.06] rounded-lg px-4 py-3 text-warm text-sm font-light placeholder:text-warm-muted/25 outline-none focus:border-amber/30 transition-colors"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-400/70 text-xs font-light">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim() || !hostName.trim()}
            className="w-full py-3 rounded-lg bg-warm text-void text-sm font-semibold hover:bg-warm/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Creating..." : "Start the party"}
          </button>
        </form>

        <div className="text-center mt-6 fade-in" style={{ animationDelay: "0.3s" }}>
          <a
            href="/join"
            className="text-warm-muted/30 text-[11px] font-light hover:text-warm-muted/50 transition-colors"
          >
            Have a code? Join a party
          </a>
        </div>
      </div>
    </div>
  );
}
