interface PartyHeaderProps {
  partyName: string;
  partyCode?: string;
  timeRemaining: string;
  onQueueToggle: () => void;
  onInvite?: () => void;
  inviteCopied?: boolean;
  onCopyCode?: () => void;
  codeCopied?: boolean;
  onPeopleToggle?: () => void;
  participantCount?: number;
}

export default function PartyHeader({
  partyName,
  partyCode,
  timeRemaining,
  onQueueToggle,
  onInvite,
  inviteCopied,
  onCopyCode,
  codeCopied,
  onPeopleToggle,
  participantCount = 0,
}: PartyHeaderProps) {
  return (
    <div className="absolute top-14 left-0 right-0 z-20 flex items-center justify-between px-3 sm:px-6 py-2">
      <div className="flex items-center gap-3 sm:gap-5 min-w-0">
        <button
          onClick={onQueueToggle}
          className="flex items-center gap-1.5 sm:gap-2 text-warm-muted hover:text-warm transition-colors text-sm shrink-0"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M4 6h16M4 12h16M4 18h12" />
          </svg>
          <span className="font-medium hidden sm:inline">Queue</span>
        </button>

        <div className="w-px h-4 bg-white/10 hidden sm:block" />

        <span className="text-sm text-warm font-light truncate hidden sm:block max-w-[120px] lg:max-w-none">{partyName}</span>

        <div className="flex items-center gap-1.5 text-warm-muted shrink-0">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="text-xs tabular-nums">{timeRemaining}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {partyCode && (
          <button
            onClick={onCopyCode}
            className="group flex items-center gap-1.5 transition-all duration-300"
            title="Copy room code"
          >
            <span className="text-[10px] text-warm-muted/50 font-light tracking-wider uppercase hidden sm:inline">
              Room:
            </span>
            <span
              className={`text-[10px] sm:text-[11px] font-mono tracking-[0.15em] sm:tracking-[0.2em] transition-all duration-300 ${
                codeCopied
                  ? "text-amber"
                  : "text-warm-muted group-hover:text-warm"
              }`}
            >
              {codeCopied ? "Copied!" : partyCode}
            </span>
          </button>
        )}

        <button
          onClick={onInvite}
          className="text-[11px] sm:text-xs font-medium px-3 sm:px-4 py-1.5 rounded-full bg-warm/10 text-warm hover:bg-warm/15 transition-all duration-300 border border-warm/20"
        >
          {inviteCopied ? "Copied!" : "Invite"}
        </button>

        <button
          onClick={onPeopleToggle}
          className="relative text-warm-muted hover:text-warm transition-colors"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {participantCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-amber/80 text-void text-[8px] font-bold flex items-center justify-center px-0.5">
              {participantCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
