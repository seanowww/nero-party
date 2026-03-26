import { useState } from "react";
import ProgressBar from "../ui/ProgressBar";

interface PlayerControlsProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onPlayPause?: () => void;
  onSeek?: (time: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

export default function PlayerControls({
  currentTime,
  duration,
  isPlaying,
  onPlayPause,
  onSeek,
  onPrevious,
  onNext,
}: PlayerControlsProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative z-20 flex flex-col items-center gap-5 fade-in-up"
      style={{ animationDelay: "0.2s" }}
    >
      <ProgressBar
        currentTime={currentTime}
        duration={duration}
        onSeek={onSeek}
      />

      <div className="flex items-center gap-6 sm:gap-10">
        {/* Previous */}
        <button
          onClick={onPrevious}
          className="text-warm/30 hover:text-warm/60 transition-colors duration-200 active:scale-95"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <rect x="3" y="5" width="2.5" height="14" rx="0.5" />
            <polygon points="20,5 9,12 20,19" />
          </svg>
        </button>

        {/* Play / Pause */}
        <button
          onClick={onPlayPause}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="w-14 h-14 rounded-full bg-warm flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            boxShadow: hovered
              ? "0 0 30px rgba(212, 165, 116, 0.25)"
              : "0 0 20px rgba(212, 165, 116, 0.1)",
          }}
        >
          {isPlaying ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#0a0a0a">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#0a0a0a">
              <polygon points="8,4 20,12 8,20" />
            </svg>
          )}
        </button>

        {/* Next */}
        <button
          onClick={onNext}
          className="text-warm/30 hover:text-warm/60 transition-colors duration-200 active:scale-95"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <polygon points="4,5 15,12 4,19" />
            <rect x="18.5" y="5" width="2.5" height="14" rx="0.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
