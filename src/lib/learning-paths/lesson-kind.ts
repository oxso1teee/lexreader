// Вид урока — из пространства имён его ключа (grammar.articles, topic.small_talk).
// Ключи стабильны и никогда не переименовываются (см. types.ts), поэтому
// префикс — честный источник: ничего не придумываем и не храним в БД.
export type LessonKind = "grammar" | "vocabulary" | "reading" | "writing" | "topic";

export const LESSON_KIND_LABEL: Record<LessonKind, string> = {
  grammar: "Грамматика",
  vocabulary: "Слова",
  reading: "Чтение",
  writing: "Письмо",
  topic: "Тема",
};

export function lessonKind(skillKey: string): LessonKind {
  const namespace = skillKey.split(".")[0];
  return namespace in LESSON_KIND_LABEL ? (namespace as LessonKind) : "topic";
}
