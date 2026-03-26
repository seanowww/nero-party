import { useState, useCallback, useRef, useEffect } from "react";
import { searchSpotify, type SpotifyTrackResult } from "../../lib/api";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTrack: (track: SpotifyTrackResult) => void;
}

export default function SearchModal({
  isOpen,
  onClose,
  onAddTrack,
}: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifyTrackResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedUri, setAddedUri] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const addedTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    clearTimeout(debounceRef.current);

    if (!q.trim()) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchSpotify(q);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleSelect = (track: SpotifyTrackResult) => {
    onAddTrack(track);
    setAddedUri(track.spotifyUri);
    clearTimeout(addedTimerRef.current);
    addedTimerRef.current = setTimeout(() => setAddedUri(null), 2000);
  };

  const formatDuration = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-void/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-md sm:mx-4 bg-surface border border-white/[0.06] rounded-t-2xl sm:rounded-2xl overflow-hidden fade-in-up">
        {/* Search input */}
        <div className="p-4 border-b border-white/[0.06]">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search for a song..."
            className="w-full bg-transparent text-warm text-sm font-light placeholder:text-warm-muted/40 outline-none"
          />
        </div>

        {/* Results */}
        <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto queue-scroll">
          {loading && (
            <div className="p-6 text-center text-warm-muted/40 text-xs font-light">
              Searching...
            </div>
          )}

          {!loading && results.length === 0 && query.trim() && (
            <div className="p-6 text-center text-warm-muted/40 text-xs font-light">
              No results found
            </div>
          )}

          {!loading && results.length === 0 && !query.trim() && (
            <div className="p-6 text-center text-warm-muted/30 text-xs font-light italic">
              Type to search Spotify
            </div>
          )}

          {results.map((track) => {
            const justAdded = addedUri === track.spotifyUri;
            return (
              <button
                key={track.spotifyUri}
                onClick={() => handleSelect(track)}
                className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.03] transition-colors duration-200 text-left"
              >
                <img
                  src={track.albumArt}
                  alt=""
                  className="w-10 h-10 rounded-md object-cover shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-warm text-[13px] font-medium truncate">
                    {track.title}
                  </div>
                  <div className="text-warm-muted/60 text-[11px] font-light truncate">
                    {track.artist}
                  </div>
                </div>
                {justAdded ? (
                  <span className="text-emerald-400/70 text-[10px] font-medium shrink-0">
                    Added
                  </span>
                ) : (
                  <span className="text-warm-muted/30 text-[10px] font-light shrink-0">
                    {formatDuration(track.durationMs)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Close hint */}
        <div className="p-2 border-t border-white/[0.04] text-center">
          <span className="text-warm-muted/20 text-[10px] font-light">
            esc to close
          </span>
        </div>
      </div>
    </div>
  );
}
