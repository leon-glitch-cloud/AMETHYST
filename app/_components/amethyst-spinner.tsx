export function AmethystSpinner({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label="Lädt…"
      className={`inline-block shrink-0 animate-spin ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <span
        className="block h-full w-full"
        style={{
          background:
            "linear-gradient(135deg, #C4B5FD 0%, #8B5CF6 55%, #6D28D9 100%)",
          clipPath:
            "polygon(50% 4%, 88% 30%, 88% 68%, 50% 96%, 12% 68%, 12% 30%)",
        }}
      />
    </span>
  );
}
