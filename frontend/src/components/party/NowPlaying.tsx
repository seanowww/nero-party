import { useRef, useLayoutEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";

interface Track {
  title: string;
  artist: string;
  artwork: string;
  color: string;
}

interface NowPlayingProps {
  /** All tracks in the queue, in order */
  allTracks?: Track[];
  /** Index of the currently playing track in allTracks */
  currentIndex?: number;
  // Legacy single-track props (used when allTracks not provided)
  current: Track;
  previous?: Track;
  next?: Track;
  deeperPrevious?: Track[];
  deeperNext?: Track[];
  onPrevious?: () => void;
  onNext?: () => void;
  onAddSong?: () => void;
  titleAction?: React.ReactNode;
  isPlaying?: boolean;
}

// Fixed number of ghost padding slots on each side.
// Always rendered in the DOM so the strip structure never changes.
const GHOST_SLOTS = 2;

export default function NowPlaying({
  allTracks,
  currentIndex = 0,
  current,
  previous,
  next,
  deeperPrevious = [],
  deeperNext = [],
  onPrevious,
  onNext,
  onAddSong,
  titleAction,
}: NowPlayingProps) {
  // Build the full track list from either allTracks or legacy props
  const tracks: Track[] = allTracks || (() => {
    const list: Track[] = [];
    list.push(...[...deeperPrevious].reverse());
    if (previous) list.push(previous);
    list.push(current);
    if (next) list.push(next);
    list.push(...deeperNext);
    return list;
  })();

  const activeIndex = allTracks
    ? currentIndex
    : (deeperPrevious.length + (previous ? 1 : 0));

  const realBefore = activeIndex;
  const realAfter = tracks.length - 1 - activeIndex;

  const CARD_GAP = 24;

  // The active card is always at DOM index = GHOST_SLOTS + activeIndex
  // (because we always render GHOST_SLOTS left ghosts)
  const activeCardIndex = GHOST_SLOTS + activeIndex;

  // Measure the actual pixel offset of the active card
  const stripRef = useRef<HTMLDivElement>(null);
  const [measuredOffset, setMeasuredOffset] = useState(0);
  const [heroWidth, setHeroWidth] = useState(0);

  const measure = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const cards = strip.children;
    if (activeCardIndex >= cards.length) return;
    const activeCard = cards[activeCardIndex] as HTMLElement;
    setMeasuredOffset(activeCard.offsetLeft);
    setHeroWidth(activeCard.offsetWidth);
  }, [activeCardIndex]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, tracks.length]);

  return (
    <div className="flex flex-col items-center gap-5 sm:gap-9">
      {/* Carousel viewport */}
      <div className="relative w-screen max-w-7xl overflow-visible pointer-events-none">
        {/* Sliding strip — fixed structure: [2 left ghosts] [real cards] [2 right ghosts] */}
        <motion.div
          ref={stripRef}
          className="flex items-center justify-start relative z-10 pointer-events-auto"
          style={{ gap: `${CARD_GAP}px` }}
          animate={{
            x: `calc(50% - ${measuredOffset}px - ${heroWidth / 2}px)`,
          }}
          transition={{
            duration: 0.5,
            ease: [0.32, 0.72, 0, 1],
          }}
        >
          {/* Left ghost slots — always 2, visibility controlled by opacity */}
          {Array.from({ length: GHOST_SLOTS }).map((_, i) => {
            const slotDist = GHOST_SLOTS - i; // 2, 1
            const needed = slotDist > realBefore; // is this slot needed (no real track here)?
            const isDeep = slotDist >= 2;
            const size = isDeep
              ? "w-20 h-20 sm:w-32 sm:h-32 lg:w-40 lg:h-40"
              : "w-28 h-28 sm:w-44 sm:h-44 lg:w-52 lg:h-52";
            return (
              <div
                key={`ghost-l-${i}`}
                className={`${size} rounded-xl flex-shrink-0 bg-white/[0.03] border border-white/[0.04] transition-opacity duration-300`}
                style={{ opacity: needed ? (isDeep ? 0.02 : 0.04) : 0 }}
              />
            );
          })}

          {/* Real track cards */}
          {tracks.map((track, i) => {
            const distFromCenter = Math.abs(i - activeIndex);
            const isCenter = i === activeIndex;
            const isAdjacent = distFromCenter === 1;
            const isDeep = distFromCenter >= 2;

            const size = isCenter
              ? "w-56 h-56 sm:w-80 sm:h-80 md:w-[22rem] md:h-[22rem] lg:w-[26rem] lg:h-[26rem]"
              : isAdjacent
              ? "w-28 h-28 sm:w-44 sm:h-44 lg:w-52 lg:h-52"
              : "w-20 h-20 sm:w-32 sm:h-32 lg:w-40 lg:h-40";

            const opacity = isCenter ? 1 : isAdjacent ? 0.25 : 0.1;
            const blur = isCenter ? "" : isDeep ? "blur-[3px]" : "";

            return (
              <motion.div
                key={`card-${i}-${track.artwork}`}
                className={`${size} rounded-xl overflow-hidden flex-shrink-0 relative ${blur} group`}
                animate={{ opacity }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={{ cursor: isCenter ? "default" : "pointer" }}
                onClick={() => {
                  if (i < activeIndex && onPrevious) onPrevious();
                  if (i > activeIndex && onNext) onNext();
                }}
              >
                <img
                  src={track.artwork}
                  alt={track.title}
                  className="w-full h-full object-cover"
                />
                {isCenter && titleAction && (
                  <div className="absolute bottom-3 right-3 z-10">
                    {titleAction}
                  </div>
                )}
                {isAdjacent && (
                  <>
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          i < activeIndex
                            ? "linear-gradient(to left, rgba(10,10,10,0.6) 0%, transparent 50%)"
                            : "linear-gradient(to right, rgba(10,10,10,0.6) 0%, transparent 50%)",
                      }}
                    />
                    {/* Skip hint on hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="rgba(240,237,230,0.5)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {i < activeIndex ? (
                          <>
                            <polygon points="11,19 2,12 11,5" fill="rgba(240,237,230,0.15)" />
                            <polygon points="22,19 13,12 22,5" fill="rgba(240,237,230,0.15)" />
                          </>
                        ) : (
                          <>
                            <polygon points="13,19 22,12 13,5" fill="rgba(240,237,230,0.15)" />
                            <polygon points="2,19 11,12 2,5" fill="rgba(240,237,230,0.15)" />
                          </>
                        )}
                      </svg>
                    </div>
                  </>
                )}
              </motion.div>
            );
          })}

          {/* Right ghost slots — always 2, visibility controlled by opacity */}
          {Array.from({ length: GHOST_SLOTS }).map((_, i) => {
            const slotDist = i + 1; // 1, 2
            const needed = slotDist > realAfter; // no real track fills this slot
            const isFirst = slotDist === 1 && needed; // the adjacent-right ghost with + button
            const isDeep = slotDist >= 2;
            const size = isDeep
              ? "w-20 h-20 sm:w-32 sm:h-32 lg:w-40 lg:h-40"
              : "w-28 h-28 sm:w-44 sm:h-44 lg:w-52 lg:h-52";
            const clickable = isFirst && onAddSong;
            return (
              <div
                key={`ghost-r-${i}`}
                className={`${size} rounded-xl flex-shrink-0 flex flex-col items-center justify-center gap-2 transition-all duration-300 ease-out group ${
                  clickable ? "cursor-pointer hover:scale-[1.03]" : ""
                }`}
                style={{
                  opacity: needed ? (isDeep ? 0.02 : (clickable ? 0.2 : 0.06)) : 0,
                  background: clickable ? "rgba(255, 255, 255, 0.02)" : "rgba(255,255,255,0.03)",
                  border: clickable ? "1px dashed rgba(255, 255, 255, 0.12)" : "1px solid rgba(255,255,255,0.04)",
                }}
                onClick={clickable ? onAddSong : undefined}
                onMouseEnter={(e) => {
                  if (clickable) {
                    e.currentTarget.style.opacity = "0.45";
                    e.currentTarget.style.borderColor = "rgba(212, 165, 116, 0.25)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (clickable) {
                    e.currentTarget.style.opacity = "0.2";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
                  }
                }}
              >
                {clickable && (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-warm-muted/50 group-hover:text-amber/60 transition-colors duration-300"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                )}
              </div>
            );
          })}
        </motion.div>

        {/* Shadow for artwork depth */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 sm:w-80 sm:h-80 md:w-[22rem] md:h-[22rem] lg:w-[26rem] lg:h-[26rem] rounded-xl pointer-events-none z-[5]"
          style={{
            boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 8px 20px rgba(0,0,0,0.3)",
          }}
        />
      </div>

      {/* Track info */}
      <div className="text-center h-16 relative w-full overflow-hidden">
        <motion.div
          key={current.title + current.artist}
          className="absolute inset-x-0"
          initial={{ x: 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{
            duration: 0.4,
            ease: [0.32, 0.72, 0, 1],
          }}
        >
          <h2 className="font-display text-xl sm:text-3xl lg:text-[2.1rem] font-bold text-warm -tracking-[0.02em] px-4 sm:px-0">
            {current.title}
          </h2>
          <p className="font-body text-warm/40 text-xs mt-1 font-medium tracking-[0.12em]">
            {current.artist}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
