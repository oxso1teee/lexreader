// P0-SEC-03 release-readiness промта: `accept="image/*"` на <input> — только
// подсказка браузеру для диалога выбора файла, не защита (можно выбрать
// произвольный файл через "все файлы"). Проверяем реально на клиенте.
//
// docs/release-2026-08-22/03_BEZOPASNOST_I_PRIVATNOST.md раздел 4: `file.type`
// сам по себе — это тоже просто Content-Type, который заявил браузер (обычно
// по расширению файла), никак не подтверждённый реальным содержимым. Файл
// `evil.exe`, переименованный в `photo.jpg`, пройдёт старую проверку. Ниже —
// проверка настоящих первых байт файла (magic bytes/сигнатура формата) —
// единственное, что нельзя подделать переименованием, не изменив сам формат
// данных. Сигнатуры даны вручную (5 форматов, все константны и стабильны) —
// не тянем ради этого npm-пакет вроде `file-type`.
//
// Это по-прежнему клиентская проверка — реальный сервер-side барьер для
// word-photos частично уже есть на уровне самого Storage bucket
// (supabase/migrations/0012_word_photos_upload_limits.sql — allowed_mime_types
// список, синхронизирован с ALLOWED_IMAGE_MIME_TYPES ниже), но и та проверка
// смотрит только на заявленный Content-Type запроса, не на реальные байты —
// прямой вызов Storage API с поддельным Content-Type её обходит. Полное
// закрытие этого пути требует серверного прокси для загрузки, что за рамками
// этого фикса (см. PR).

export const MAX_IMAGE_SIZE_BYTES = 5_000_000;
export const MAX_PDF_SIZE_BYTES = 20_000_000;

export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

interface FormatSignature {
  mime: (typeof ALLOWED_IMAGE_MIME_TYPES)[number];
  matches: (bytes: Uint8Array) => boolean;
}

const IMAGE_SIGNATURES: FormatSignature[] = [
  { mime: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/png",
    matches: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    // "GIF87a" or "GIF89a"
    mime: "image/gif",
    matches: (b) =>
      b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 &&
      (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61,
  },
  {
    // "RIFF"....."WEBP" — bytes 4-7 are the chunk size, format-independent.
    mime: "image/webp",
    matches: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

const PDF_HEADER_LENGTH = 5; // "%PDF-"
const IMAGE_HEADER_LENGTH = 12; // longest signature above (WebP) needs 12 bytes

async function readHeaderBytes(file: File, length: number): Promise<Uint8Array> {
  const buffer = await file.slice(0, length).arrayBuffer();
  return new Uint8Array(buffer);
}

export async function validateImageFile(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) {
    return "Выбери файл изображения.";
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return "Файл слишком большой — максимум 5 МБ.";
  }
  const header = await readHeaderBytes(file, IMAGE_HEADER_LENGTH);
  const isRealImage = IMAGE_SIGNATURES.some((sig) => sig.matches(header));
  if (!isRealImage) {
    return "Файл повреждён или это не настоящее изображение (jpeg/png/gif/webp) — попробуй другой файл.";
  }
  return null;
}

export async function validatePdfFile(file: File): Promise<string | null> {
  if (file.type !== "application/pdf") {
    return "Выбери файл в формате PDF.";
  }
  if (file.size > MAX_PDF_SIZE_BYTES) {
    return "Файл слишком большой — максимум 20 МБ.";
  }
  const header = await readHeaderBytes(file, PDF_HEADER_LENGTH);
  const isRealPdf =
    header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46 && header[4] === 0x2d;
  if (!isRealPdf) {
    return "Файл повреждён или это не настоящий PDF — попробуй другой файл.";
  }
  return null;
}
