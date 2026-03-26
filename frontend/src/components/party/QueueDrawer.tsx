import { useState, useCallback } from "react";
import { AnimatePresence, motion, Reorder } from "framer-motion";

interface QueueTrack {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  addedBy: string;
  isPlaying?: boolean;
  voted?: boolean;
}

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: QueueTrack[];
  onAddSong?: () => void;
  onReorder?: (trackIds: string[]) => void;
  onRemove?: (trackId: string) => void;
  onVote?: (trackId: string, value: number) => void;
  canVote?: boolean;
}

function DragHandle() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className="text-warm-muted/25 shrink-0"
    >
      <circle cx="4" cy="2.5" r="1" fill="currentColor" />
      <circle cx="8" cy="2.5" r="1" fill="currentColor" />
      <circle cx="4" cy="6" r="1" fill="currentColor" />
      <circle cx="8" cy="6" r="1" fill="currentColor" />
      <circle cx="4" cy="9.5" r="1" fill="currentColor" />
      <circle cx="8" cy="9.5" r="1" fill="currentColor" />
    </svg>
  );
}

export default function QueueDrawer({
  isOpen,
  onClose,
  tracks,
  onAddSong,
  onReorder,
  onRemove,
  onVote,
  canVote = true,
}: QueueDrawerProps) {
  // Split into played/playing (locked) and upcoming (reorderable)
  const playingIndex = tracks.findIndex((t) => t.isPlaying);
  const lockedTracks = playingIndex >= 0 ? tracks.slice(0, playingIndex + 1) : [];
  const upcomingTracks = playingIndex >= 0 ? tracks.slice(playingIndex + 1) : tracks;

  const [localUpcoming, setLocalUpcoming] = useState(upcomingTracks);

  // Sync local state when props change
  const propsKey = upcomingTracks.map((t) => t.id).join(",");
  const [lastPropsKey, setLastPropsKey] = useState(propsKey);
  if (propsKey !== lastPropsKey) {
    setLocalUpcoming(upcomingTracks);
    setLastPropsKey(propsKey);
  }

  const handleReorderEnd = useCallback(() => {
    if (!onReorder) return;
    const allIds = [
      ...lockedTracks.map((t) => t.id),
      ...localUpcoming.map((t) => t.id),
    ];
    onReorder(allIds);
  }, [onReorder, lockedTracks, localUpcoming]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-30 bg-black/60"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 z-40 w-[85vw] max-w-80 bg-surface border-r border-white/5 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-4 sm:py-5 border-b border-white/5">
              <h3 className="text-warm font-medium text-sm tracking-wide">
                Queue
              </h3>
              <span className="text-warm-muted text-xs">
                {tracks.length} tracks
              </span>
            </div>

            {/* Track list */}
            <div className="flex-1 overflow-y-auto queue-scroll py-2">
              {/* Locked tracks (played + currently playing) */}
              {lockedTracks.map((track, i) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={i}
                  onVote={onVote}
                  canVote={canVote}
                />
              ))}

              {/* Upcoming tracks (reorderable) */}
              <Reorder.Group
                axis="y"
                values={localUpcoming}
                onReorder={setLocalUpcoming}
                className="list-none m-0 p-0"
              >
                {localUpcoming.map((track, i) => (
                  <Reorder.Item
                    key={track.id}
                    value={track}
                    onDragEnd={handleReorderEnd}
                    className="list-none"
                    whileDrag={{
                      scale: 1.02,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                      zIndex: 10,
                      background: "rgba(30,30,30,1)",
                      borderRadius: "8px",
                    }}
                  >
                    <div
                      className="group flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-white/[0.03] cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-center gap-1.5 w-9 shrink-0 justify-end">
                        <DragHandle />
                        <span className="text-[10px] text-warm-muted/40 tabular-nums font-light">
                          {lockedTracks.length + i + 1}
                        </span>
                      </div>
                      <div className="w-9 h-9 rounded overflow-hidden flex-shrink-0">
                        <img
                          src={track.artwork}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] truncate text-warm">
                          {track.title}
                        </p>
                        <p className="text-[11px] text-warm-muted/50 truncate">
                          {track.artist}
                        </p>
                      </div>
                      <span className="text-[10px] text-warm-muted/30 font-light flex-shrink-0 group-hover:hidden">
                        {track.addedBy}
                      </span>
                      {onRemove && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemove(track.id);
                          }}
                          className="hidden group-hover:flex w-6 h-6 items-center justify-center rounded-full hover:bg-red-400/15 text-warm-muted/30 hover:text-red-400/80 transition-colors flex-shrink-0 cursor-pointer"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            </div>

            {/* Add song prompt */}
            <div className="px-4 sm:px-5 py-4 border-t border-white/5">
              <button
                onClick={onAddSong}
                className="w-full py-2.5 rounded-lg glass-subtle text-warm-muted text-sm hover:text-warm hover:bg-white/[0.06] transition-all flex items-center justify-center gap-2"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add a song
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function TrackRow({
  track,
  index,
  onVote,
  canVote = true,
}: {
  track: QueueTrack;
  index: number;
  onVote?: (trackId: string, value: number) => void;
  canVote?: boolean;
}) {
  const showVote = !!onVote;
  const votable = track.voted || canVote;

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${
        track.isPlaying ? "bg-white/[0.04]" : "opacity-50 hover:opacity-70"
      }`}
    >
      <div className="w-9 shrink-0 flex justify-end">
        {track.isPlaying ? (
          <span className="inline-block w-2 h-2 rounded-full bg-amber animate-pulse" />
        ) : (
          <span className="text-[10px] text-warm-muted/40 tabular-nums font-light">
            {index + 1}
          </span>
        )}
      </div>

      <div className="w-9 h-9 rounded overflow-hidden flex-shrink-0">
        <img
          src={track.artwork}
          alt={track.title}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={`text-[13px] truncate ${
            track.isPlaying ? "text-amber" : "text-warm"
          }`}
        >
          {track.title}
        </p>
        <p className="text-[11px] text-warm-muted/50 truncate">{track.artist}</p>
      </div>

      {showVote ? (
        <button
          onClick={() => votable && onVote(track.id, track.voted ? 0 : 1)}
          disabled={!votable}
          className={`w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200 flex-shrink-0 ${
            track.voted
              ? "text-amber bg-amber/10"
              : votable
                ? "text-warm-muted/30 hover:text-amber/60 hover:bg-amber/5"
                : "text-warm-muted/15 cursor-not-allowed"
          }`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill={track.voted ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      ) : (
        <span className="text-[10px] text-warm-muted/30 font-light flex-shrink-0">
          {track.addedBy}
        </span>
      )}
    </div>
  );
}
