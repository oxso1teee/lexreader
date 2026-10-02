// redesign/duolingo-flat phase 2: иконки для next/og ImageResponse (Satori).
// lucide-react 1.x помечен "use client" — его компоненты нельзя вызвать из
// серверного route/opengraph-image (build падает с "Attempted to call ... from
// the server"). Поэтому здесь — та же геометрия lucide (скопирована из
// node_modules/lucide-react/dist/esm/icons/*.mjs, __iconNode), в виде обычного
// <svg>, который Satori рендерит сам. Только иконки, реально нужные OG-картинкам.

type OgIconProps = { size: number; color: string };

function OgSvg({ size, color, children }: OgIconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function OgBookOpen(props: OgIconProps) {
  return (
    <OgSvg {...props}>
      <path d="M12 5v16" />
      <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />
    </OgSvg>
  );
}

export function OgFlame(props: OgIconProps) {
  return (
    <OgSvg {...props}>
      <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />
    </OgSvg>
  );
}

export function OgAward(props: OgIconProps) {
  return (
    <OgSvg {...props}>
      <path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" />
      <circle cx="12" cy="8" r="6" />
    </OgSvg>
  );
}
