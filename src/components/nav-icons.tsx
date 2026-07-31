// Раздел 5 промта 2026-07-30 (полировка): один контурный набор иконок для
// пяти кнопок нижней навигации — эмодзи остаются в бейджах и праздничных
// моментах, где они к месту, но для главных кнопок экрана свой набор
// выглядит собраннее и одинаково на всех устройствах.
function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      {children}
    </svg>
  );
}

export function HomeIcon() {
  return (
    <IconBase>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </IconBase>
  );
}

export function LibraryIcon() {
  return (
    <IconBase>
      <path d="M4 4h9v18H4z" />
      <path d="M13 4h7v18h-7" />
    </IconBase>
  );
}

export function BrainIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </IconBase>
  );
}

export function ProgressIcon() {
  return (
    <IconBase>
      <path d="M4 20V10M12 20V4M20 20v-7" />
    </IconBase>
  );
}

export function SettingsIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </IconBase>
  );
}
