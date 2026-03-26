interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek?: (time: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ProgressBar({
  currentTime,
  duration,
  onSeek,
}: ProgressBarProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(fraction * duration);
  };

  return (
    <div className="w-[75vw] max-w-56 sm:max-w-80 md:max-w-[22rem] lg:max-w-[26rem] mx-auto flex flex-col gap-1.5 relative z-[100] pointer-events-auto">
      {/* Hit area */}
      <div
        className={`relative h-6 flex items-center ${onSeek ? "cursor-pointer" : "cursor-default"} group`}
        onClick={handleClick}
      >
        {/* Track */}
        <div className="w-full h-[2px] bg-white/[0.08] rounded-full relative overflow-hidden">
          <div
            className="h-full bg-warm/30 rounded-full transition-[width] duration-300 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        {/* Scrubber dot */}
        {onSeek && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-warm rounded-full group-hover:scale-125 transition-transform duration-150 pointer-events-none"
            style={{ left: `${progress}%` }}
          />
        )}
      </div>
      {/* Timestamps */}
      <div className="flex justify-between">
        <span className="text-[10px] font-body text-warm-muted/40 tabular-nums tracking-wider">
          {formatTime(currentTime)}
        </span>
        <span className="text-[10px] font-body text-warm-muted/40 tabular-nums tracking-wider">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
