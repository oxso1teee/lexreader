// SVG из макета v7 (Main.dc.html) — пламя, молния и маскот одной геометрией
// с моментами, чтобы главный экран и праздники выглядели одной системой.
export function FlameIcon({ size = 20, fill = "var(--ember)", inner = "var(--sun)" }: { size?: number; fill?: string; inner?: string | null }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill={fill} />
      {inner && (
        <path d="M12 12c.6 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 1.5-3.5.2 1 .7 1.5 1.2 1.5 0-1.5-.4-2.5.3-3.5z" fill={inner} />
      )}
    </svg>
  );
}

export function BoltIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="var(--sun)" stroke="var(--sun-edge)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function MascotSmall({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 128 150" width={size} height={(size * 150) / 128} aria-hidden="true">
      <ellipse cx="64" cy="128" rx="34" ry="9" fill="rgba(0,0,0,0.06)" />
      <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
      <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
      <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
      <ellipse cx="94" cy="96" rx="8" ry="5" fill="var(--sun)" transform="rotate(-28 94 96)" opacity="0.85" />
    </svg>
  );
}
