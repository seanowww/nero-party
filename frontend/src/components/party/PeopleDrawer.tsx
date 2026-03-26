import { AnimatePresence, motion } from "framer-motion";
import Avatar from "../ui/Avatar";

interface ParticipantWithStats {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  submissions: number;
  votesUsed: number;
  maxVotes: number;
}

interface PeopleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  participants: ParticipantWithStats[];
}

export default function PeopleDrawer({
  isOpen,
  onClose,
  participants,
}: PeopleDrawerProps) {
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

          {/* Drawer — slides from right */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-40 w-[80vw] max-w-72 bg-surface border-l border-white/5 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-4 sm:py-5 border-b border-white/5">
              <h3 className="text-warm font-medium text-sm tracking-wide">
                People
              </h3>
              <span className="text-warm-muted text-xs">
                {participants.length} in the room
              </span>
            </div>

            {/* Participant list */}
            <div className="flex-1 overflow-y-auto py-2">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-5 py-3 hover:bg-white/[0.03] transition-colors"
                >
                  <Avatar name={p.name} color={p.color} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-warm truncate">
                        {p.name}
                      </span>
                      {p.isHost && (
                        <span className="text-[9px] font-semibold tracking-wider uppercase text-amber/70 bg-amber/10 px-1.5 py-0.5 rounded flex-shrink-0">
                          Host
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-warm-muted/40 font-light">
                      {p.submissions} {p.submissions === 1 ? "song" : "songs"} queued · {p.votesUsed}/{p.maxVotes} votes
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
