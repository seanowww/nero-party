import Avatar from "../ui/Avatar";

interface Participant {
  id: string;
  name: string;
  color: string;
}

interface ParticipantsProps {
  participants: Participant[];
}

export default function Participants({ participants }: ParticipantsProps) {
  const visible = participants.slice(0, 4);

  return (
    <div
      className="absolute top-28 right-3 sm:right-6 z-20 flex items-center gap-2 opacity-70"
    >
      <div className="flex -space-x-1.5">
        {visible.map((p) => (
          <Avatar key={p.id} name={p.name} color={p.color} size="sm" />
        ))}
      </div>
      <span className="text-[11px] text-warm-muted/60 font-light">
        {participants.length} in the room
      </span>
    </div>
  );
}
