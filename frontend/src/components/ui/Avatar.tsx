interface AvatarProps {
  name: string;
  color: string;
  size?: "sm" | "md";
}

const sizes = {
  sm: "w-7 h-7 text-[10px]",
  md: "w-9 h-9 text-xs",
};

export default function Avatar({ name, color, size = "md" }: AvatarProps) {
  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-medium text-white/80 ring-1 ring-void/80`}
      style={{ backgroundColor: color }}
      title={name}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
