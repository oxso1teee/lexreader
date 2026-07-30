import type { SVGProps } from "react";

// docs/IMPLEMENTATION_PROMPT_REDESIGN_2026-07-30.md, раздел 2: набор line-иконок
// вместо эмодзи в навигации и кнопках действий. Без внешних иконных библиотек.
function base(props: SVGProps<SVGSVGElement>) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10.5V19a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-8.5" />
    </svg>
  );
}

export function IconBook(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 5.5c2-1 5-1 7 .5v13c-2-1.5-5-1.5-7-.5Z" />
      <path d="M20 5.5c-2-1-5-1-7 .5v13c2-1.5 5-1.5 7-.5Z" />
    </svg>
  );
}

// Мозг → колоды: стопка карточек точнее сообщает содержимое раздела, чем
// буквальный "мозг" (артефакт v2, экран "Мозг · колоды", callout 1).
export function IconCards(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="9" width="14" height="10" rx="2" opacity="0.5" />
      <rect x="6" y="5" width="14" height="10" rx="2" />
    </svg>
  );
}

export function IconChart(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M5 19V10M12 19V5M19 19v-6" />
    </svg>
  );
}

export function IconSettings(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h13M21 17h-1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="7" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M5 13l4 4 10-10" />
    </svg>
  );
}

export function IconFlame(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 3c1 3-3 4-3 8a3 3 0 0 0 6 0c0-1.2-.6-2-1-3 1.5.5 3 2.3 3 4.5A5.5 5.5 0 0 1 6 12.5C6 8 12 6 12 3Z" />
    </svg>
  );
}

export function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </svg>
  );
}

export function IconPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconTrash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
    </svg>
  );
}

export function IconPlay(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M7 5.5v13l11-6.5Z" />
    </svg>
  );
}
