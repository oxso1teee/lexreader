export interface ParsedImportCard {
  front: string;
  back: string;
  notes?: string;
}

const FRONT_HEADERS = new Set(["front", "phrase", "english", "word", "term", "question"]);
const BACK_HEADERS = new Set(["back", "translation", "russian", "meaning", "answer"]);
const NOTES_HEADERS = new Set(["notes", "note", "comment", "example"]);
const MAX_IMPORT_CARDS = 2_000;

function cleanCell(value: unknown): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
}

function normalizeHeader(value: string): string {
  return cleanCell(value).toLowerCase().replace(/\s+/g, "_");
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows.filter((values) => values.some((value) => value.trim()));
}

function delimiterScore(text: string, delimiter: string): number {
  const rows = parseDelimited(text, delimiter).slice(0, 20);
  const widths = rows.map((row) => row.length).filter((width) => width >= 2);
  if (widths.length === 0) return 0;
  const commonWidth = widths.sort(
    (a, b) => widths.filter((value) => value === b).length - widths.filter((value) => value === a).length,
  )[0];
  return widths.filter((width) => width === commonWidth).length * commonWidth;
}

function detectDelimiter(text: string, extension: string): string | null {
  if (extension === "tsv") return "\t";
  const delimiters = [",", ";", "\t"];
  const ranked = delimiters
    .map((delimiter) => ({ delimiter, score: delimiterScore(text, delimiter) }))
    .sort((a, b) => b.score - a.score);
  return ranked[0].score > 0 ? ranked[0].delimiter : null;
}

function cardsFromRows(rows: string[][]): ParsedImportCard[] {
  if (rows.length === 0) return [];

  const headers = rows[0].map(normalizeHeader);
  const frontIndex = headers.findIndex((header) => FRONT_HEADERS.has(header));
  const backIndex = headers.findIndex((header) => BACK_HEADERS.has(header));
  const notesIndex = headers.findIndex((header) => NOTES_HEADERS.has(header));
  const hasHeader = frontIndex >= 0 || backIndex >= 0 || notesIndex >= 0;
  const resolvedFront = frontIndex >= 0 ? frontIndex : 0;
  const resolvedBack = backIndex >= 0 ? backIndex : 1;
  const resolvedNotes = notesIndex >= 0 ? notesIndex : 2;

  return rows.slice(hasHeader ? 1 : 0).map((row) => ({
    front: cleanCell(row[resolvedFront]),
    back: cleanCell(row[resolvedBack]),
    notes: cleanCell(row[resolvedNotes]) || undefined,
  }));
}

function cardsFromJson(data: unknown): ParsedImportCard[] {
  let source: unknown[] | null = null;
  if (Array.isArray(data)) {
    source = data;
  } else if (data && typeof data === "object") {
    const object = data as Record<string, unknown>;
    if (Array.isArray(object.cards)) source = object.cards;
    else if (Array.isArray(object.phrases)) source = object.phrases;
  }

  if (!source) {
    throw new Error('JSON должен содержать массив карточек или поле "cards"/"phrases".');
  }

  return source.map((item) => {
    if (typeof item === "string") return { front: cleanCell(item), back: "" };
    if (!item || typeof item !== "object") return { front: "", back: "" };
    const object = item as Record<string, unknown>;
    return {
      front: cleanCell(
        object.front ?? object.phrase ?? object.english ?? object.word ?? object.term ?? object.question,
      ),
      back: cleanCell(
        object.back ?? object.translation ?? object.russian ?? object.meaning ?? object.answer,
      ),
      notes: cleanCell(object.notes ?? object.note ?? object.comment ?? object.example) || undefined,
    };
  });
}

function cardsFromText(text: string): ParsedImportCard[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      for (const delimiter of ["\t", " — ", " – ", ";"]) {
        const index = line.indexOf(delimiter);
        if (index > 0) {
          return {
            front: cleanCell(line.slice(0, index)),
            back: cleanCell(line.slice(index + delimiter.length)),
          };
        }
      }
      return { front: cleanCell(line), back: "" };
    });
}

function validateCards(cards: ParsedImportCard[]): ParsedImportCard[] {
  const nonEmpty = cards.filter((card) => card.front || card.back);
  if (nonEmpty.length === 0) throw new Error("В файле не нашлось карточек.");
  if (nonEmpty.length > MAX_IMPORT_CARDS) {
    throw new Error(`За один раз можно импортировать не больше ${MAX_IMPORT_CARDS} карточек.`);
  }

  const incomplete = nonEmpty.filter((card) => !card.front || !card.back).length;
  if (incomplete > 0) {
    throw new Error(
      `У ${incomplete} из ${nonEmpty.length} строк нет фразы или перевода. Нужны две колонки: phrase и translation.`,
    );
  }

  const seen = new Set<string>();
  return nonEmpty.filter((card) => {
    const key = `${card.front.toLocaleLowerCase()}\u0000${card.back.toLocaleLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseImportCards(fileName: string, text: string): ParsedImportCard[] {
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  if (extension === "html" || extension === "htm" || /<!doctype\s+html|<html[\s>]/i.test(text)) {
    throw new Error(
      "Это сохранённая веб-страница HTML, а не файл карточек. Скачай исходный CSV/JSON или используй шаблон.",
    );
  }

  let cards: ParsedImportCard[];
  if (extension === "json") {
    cards = cardsFromJson(JSON.parse(text) as unknown);
  } else if (extension === "txt") {
    cards = cardsFromText(text);
  } else {
    const delimiter = detectDelimiter(text, extension);
    cards = delimiter ? cardsFromRows(parseDelimited(text, delimiter)) : cardsFromText(text);
  }

  return validateCards(cards);
}
