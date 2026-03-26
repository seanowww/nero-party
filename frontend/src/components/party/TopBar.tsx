import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface TopBarProps {
  onLeave: () => void;
  onEndParty?: () => void;
  isHost?: boolean;
}

type ConfirmType = "leave" | "end" | null;

export default function TopBar({ onLeave, onEndParty, isHost }: TopBarProps) {
  const [confirmType, setConfirmType] = useState<ConfirmType>(null);

  const confirmConfig = {
    leave: {
      title: "Leave this party?",
      subtitle: "You can rejoin later with the invite link.",
      action: "Leave",
      onConfirm: onLeave,
    },
    end: {
      title: "End this party?",
      subtitle: "This will end the session for everyone and show final results.",
      action: "End party",
      onConfirm: onEndParty,
    },
  };

  const config = confirmType ? confirmConfig[confirmType] : null;

  return (
    <>
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setConfirmType("leave")}
            className="text-warm-muted hover:text-warm transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
          </button>
          <span className="text-[10px] font-semibold tracking-widest uppercase text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
            Live
          </span>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2">
          <span className="text-warm-muted text-sm font-light tracking-wide">
            nero
          </span>
        </div>

        {isHost && (
          <button
            onClick={() => setConfirmType("end")}
            className="text-[11px] text-white hover:text-red-400 transition-colors font-medium tracking-wide"
          >
            End party
          </button>
        )}
      </div>

      {/* Confirmation modal */}
      <AnimatePresence>
        {config && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setConfirmType(null)}
              className="fixed inset-0 z-50 bg-black/60"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            >
              <div className="pointer-events-auto bg-surface border border-white/[0.08] rounded-2xl px-6 sm:px-8 py-5 sm:py-6 max-w-[calc(100vw-2rem)] sm:max-w-xs text-center shadow-2xl mx-4">
                <p className="text-warm text-sm font-medium mb-1">
                  {config.title}
                </p>
                <p className="text-warm-muted/50 text-xs mb-5">
                  {config.subtitle}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmType(null)}
                    className="flex-1 py-2 rounded-lg text-sm text-warm-muted hover:text-warm bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setConfirmType(null);
                      config.onConfirm?.();
                    }}
                    className="flex-1 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 bg-red-400/10 hover:bg-red-400/15 transition-colors"
                  >
                    {config.action}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
