// Соответствие «токен библиотеки макетов (Ultimate Design System,
// .lex-work/ds) → токен приложения». Единственный словарь — приложения:
// у каждого токена макета здесь либо эквивалент, либо явное объяснение,
// почему его нет. Читается тестом token-map.test.ts: каждый app-токен
// обязан существовать в src/styles/tokens.css / src/app/globals.css, а те,
// что отличаются по темам, — быть переопределены в тёмной теме.

export interface TokenMapping {
  mockup: string;
  /** null — прямого эквивалента нет и не нужен (см. note). */
  app: string | null;
  role: string;
  /** Токен обязан переопределяться в :root[data-theme="dark"]. */
  themed?: boolean;
  note?: string;
}

export const TOKEN_MAP: readonly TokenMapping[] = [
  // --- поверхности ---
  { mockup: "--paper-50", app: "--background", role: "фон приложения", themed: true },
  { mockup: "--paper-0", app: "--surface", role: "карточка", themed: true },
  { mockup: "--surface-card", app: "--surface", role: "карточка", themed: true },
  { mockup: "--surface-app", app: "--background", role: "фон приложения", themed: true },
  { mockup: "--paper-100", app: "--surface-muted", role: "утопленная поверхность", themed: true },
  { mockup: "--surface-sunken", app: "--surface-sunken", role: "утопленная поверхность", themed: true },
  { mockup: "--surface-raised", app: "--surface-elevated", role: "плавающий слой", themed: true },
  { mockup: "--surface-overlay", app: "--surface-elevated", role: "диалог, меню", themed: true },
  { mockup: "--paper-200", app: null, role: "холст вокруг рамки устройства", note: "в приложении холста нет — страница сама заполняет окно" },
  { mockup: "--paper-300", app: "--border-strong", role: "трек прогресса / разделители" },
  // --- текст ---
  { mockup: "--ink-900", app: "--foreground", role: "основной текст", themed: true },
  { mockup: "--text-1", app: "--foreground", role: "основной текст", themed: true },
  { mockup: "--ink-600", app: "--text-secondary", role: "вторичный текст", themed: true },
  { mockup: "--text-2", app: "--text-secondary", role: "вторичный текст", themed: true },
  { mockup: "--ink-400", app: "--text-tertiary", role: "подписи, мета", themed: true },
  { mockup: "--text-3", app: "--text-tertiary", role: "подписи, мета", themed: true },
  { mockup: "--text-disabled", app: "--text-disabled", role: "недоступное", themed: true },
  // --- границы ---
  { mockup: "--stroke", app: "--border-strong", role: "рамка карточки 2px", themed: true },
  { mockup: "--stroke-soft", app: "--border", role: "разделитель 1px", themed: true },
  // --- акцент: leaf (главное действие, успех, прогресс) ---
  { mockup: "--green-400", app: "--leaf", role: "заливка главного действия" },
  { mockup: "--fill-leaf", app: "--leaf", role: "заливка под белый текст", themed: true },
  { mockup: "--green-600", app: "--leaf-edge", role: "нижняя кромка кнопки" },
  { mockup: "--green-700", app: "--leaf-deep", role: "тёмный акцент" },
  { mockup: "--green-100", app: "--leaf-tint", role: "светлая подложка", themed: true },
  { mockup: "--green-200", app: "--leaf-tint-strong", role: "подложка усиленная", themed: true },
  { mockup: "--green-500", app: "--leaf-text", role: "зелёный текст", themed: true },
  { mockup: "--green-text", app: "--leaf-text", role: "зелёный текст", themed: true },
  // --- sky (память, SRS, информация) ---
  { mockup: "--blue-400", app: "--sky", role: "яркий акцент: иконки, графики", themed: true },
  { mockup: "--blue-500", app: "--sky-fill", role: "заливка под белый текст", themed: true },
  { mockup: "--fill-sky", app: "--sky-fill", role: "заливка под белый текст", themed: true },
  { mockup: "--blue-700", app: "--sky-fill-edge", role: "нижняя кромка", themed: true },
  { mockup: "--blue-100", app: "--sky-tint", role: "светлая подложка", themed: true },
  { mockup: "--blue-600", app: "--sky-text", role: "синий текст", themed: true },
  { mockup: "--blue-text", app: "--sky-text", role: "синий текст", themed: true },
  // --- ember (стрик, срочность) ---
  { mockup: "--orange-600", app: "--ember-fill", role: "заливка стрика под белый текст", themed: true },
  { mockup: "--fill-ember", app: "--ember-fill", role: "заливка под белый текст", themed: true },
  { mockup: "--orange-700", app: "--ember-fill-edge", role: "нижняя кромка", themed: true },
  { mockup: "--gold-500", app: "--ember", role: "яркий оранжевый: иконки, огонь", themed: true },
  { mockup: "--gold-150", app: "--ember-tint", role: "светлая подложка", themed: true },
  { mockup: "--orange-text", app: "--ember-text", role: "оранжевый текст", themed: true },
  // --- sun (XP, награды, Plus) ---
  { mockup: "--gold-400", app: "--sun", role: "жёлтая заливка (тёмный текст)", themed: true },
  { mockup: "--fill-sun", app: "--sun", role: "заливка под тёмный текст", themed: true },
  { mockup: "--gold-600", app: "--sun-edge", role: "нижняя кромка", themed: true },
  { mockup: "--gold-100", app: "--sun-tint", role: "светлая подложка", themed: true },
  { mockup: "--gold-700", app: "--sun-text", role: "жёлтый текст", themed: true },
  { mockup: "--gold-text", app: "--sun-text", role: "жёлтый текст", themed: true },
  // --- danger ---
  { mockup: "--red-400", app: "--danger", role: "заливка ошибки / опасного действия", themed: true },
  { mockup: "--fill-red", app: "--danger", role: "заливка под белый текст", themed: true },
  { mockup: "--red-600", app: "--danger-edge", role: "нижняя кромка", themed: true },
  { mockup: "--red-100", app: "--danger-tint", role: "светлая подложка", themed: true },
  { mockup: "--red-text", app: "--danger-text", role: "красный текст", themed: true },
  // --- ink (ИИ / planned) ---
  { mockup: "--fill-ink", app: "--ink-fill", role: "ИИ / planned: заливка", themed: true },
  { mockup: "--purple-500", app: null, role: "удалён из продукта", note: "фиолетового ИИ-акцента больше нет; ИИ и planned — ink-fill + жёлтый ink-fill-text" },
  // --- форма, тени, движение ---
  { mockup: "--r-md", app: "--radius-btn", role: "радиус кнопки 16px" },
  { mockup: "--r-sm", app: "--radius-control", role: "радиус поля 12px" },
  { mockup: "--r-lg", app: "--radius-card", role: "радиус карточки 20px" },
  { mockup: "--r-2xl", app: "--radius-sheet", role: "радиус шита 28px" },
  { mockup: "--shadow-2", app: "--shadow-float", role: "плавающий слой", themed: true },
  { mockup: "--shadow-3", app: "--shadow-sheet", role: "нижний шит", themed: true },
  { mockup: "--scrim", app: "--scrim", role: "подложка модального окна", themed: true },
  { mockup: "--ease-out", app: "--ease-out", role: "кривая движения" },
  { mockup: "--dur-2", app: "--dur-base", role: "длительность" },
  { mockup: "--z-modal", app: "--z-modal", role: "слой" },
  { mockup: "--z-toast", app: "--z-toast", role: "слой" },
  { mockup: "--sp-*", app: null, role: "шкала отступов 4pt", note: "это стандартная шкала Tailwind (p-1 = 4px, p-4 = 16px) — отдельных токенов не заводим" },
] as const;
