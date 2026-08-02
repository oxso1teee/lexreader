// Относительный импорт (не @/lib/fsrs) — src/lib/fsrs.test.ts и
// src/lib/fsrs-flags.test.ts запускаются напрямую через node --test без
// сборщика/tsconfig-paths, alias'ы там не резолвятся.
import { isFsrsEnabled, isFsrsEnabledForUser, isFsrsSchemaReady } from "./fsrs.ts";

export interface FsrsFlags {
  /** Migration 0032 подтверждённо применена (FSRS_SCHEMA_READY=true). */
  schemaReady: boolean;
  /** FSRS реально авторитетен для due_at — схема готова И (глобальный флаг включён ИЛИ этот пользователь в allowlist'е). */
  enabled: boolean;
  /** Можно читать/писать fsrs_*-поля и review_log.scheduler_type/*_state_json. */
  shadowEnabled: boolean;
}

/**
 * FSRS Schema Compatibility Hotfix + FSRS Controlled Activation: единственное
 * место, где парсятся FSRS_SCHEMA_READY/FSRS_ENABLED/FSRS_ENABLED_USER_IDS и
 * решается их комбинация — reviewWord()/review-страница не должны сами
 * перепроверять process.env, чтобы правило ниже не разошлось по файлам.
 *
 * userId — auth.uid() вызывающего пользователя (server action/page.tsx уже
 * его знают на момент вызова) — используется ТОЛЬКО для server-side сверки
 * с allowlist'ом, наружу (клиенту) отсюда уходит исключительно итоговый
 * boolean `enabled`, не сам userId и не список. Без userId (например, если
 * вызывающий код ещё не аутентифицирован) allowlist просто не может
 * совпасть — safe by construction, не ошибка.
 *
 * enabled = schemaReady && (FSRS_ENABLED==="true" || userId в allowlist'е).
 * Аккаунт из allowlist'а получает FSRS-авторитетность независимо от
 * глобального FSRS_ENABLED — это Phase D "controlled activation" для
 * одного тестового аккаунта, не влияет ни на кого другого, пока
 * FSRS_ENABLED остаётся false.
 *
 * FSRS_ENABLED=true при FSRS_SCHEMA_READY=false — опасная конфигурация
 * (миграция 0032 ещё не применена, а флаг уже просит FSRS быть
 * авторитетным): не даём её выполнить, откатываемся на legacy-scheduler и
 * логируем диагностику без приватных данных (без flashcardId/текста
 * карточек/id пользователя — только сам факт несовпадения флагов). Флаг
 * allowlist-аккаунта в этом же случае тоже не активируется —
 * `schemaReady && (...)` гейтит оба пути одинаково.
 */
export function getFsrsFlags(userId?: string): FsrsFlags {
  const schemaReady = isFsrsSchemaReady();
  const rawEnabled = isFsrsEnabled();
  const allowlisted = isFsrsEnabledForUser(userId);

  if (rawEnabled && !schemaReady) {
    console.warn(
      "[fsrs] FSRS_ENABLED=true, но FSRS_SCHEMA_READY не \"true\" — используется legacy-scheduler до применения migration 0032 и установки FSRS_SCHEMA_READY=true.",
    );
  }

  return {
    schemaReady,
    enabled: schemaReady && (rawEnabled || allowlisted),
    shadowEnabled: schemaReady,
  };
}
