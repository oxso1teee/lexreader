// Относительный импорт (не @/lib/fsrs) — src/lib/fsrs.test.ts и
// src/lib/fsrs-flags.test.ts запускаются напрямую через node --test без
// сборщика/tsconfig-paths, alias'ы там не резолвятся.
import { isFsrsEnabled, isFsrsSchemaReady } from "./fsrs.ts";

export interface FsrsFlags {
  /** Migration 0032 подтверждённо применена (FSRS_SCHEMA_READY=true). */
  schemaReady: boolean;
  /** FSRS реально авторитетен для due_at — только когда схема готова И флаг включён. */
  enabled: boolean;
  /** Можно читать/писать fsrs_*-поля и review_log.scheduler_type/*_state_json. */
  shadowEnabled: boolean;
}

/**
 * FSRS Schema Compatibility Hotfix: единственное место, где парсятся оба
 * FSRS-флага и решается их комбинация — reviewWord()/review-страница не
 * должны сами перепроверять process.env, чтобы правило ниже не разошлось
 * по файлам.
 *
 * FSRS_ENABLED=true при FSRS_SCHEMA_READY=false — опасная конфигурация
 * (миграция 0032 ещё не применена, а флаг уже просит FSRS быть
 * авторитетным): не даём её выполнить, откатываемся на legacy-scheduler и
 * логируем диагностику без приватных данных (без flashcardId/текста
 * карточек/id пользователя — только сам факт несовпадения флагов).
 */
export function getFsrsFlags(): FsrsFlags {
  const schemaReady = isFsrsSchemaReady();
  const rawEnabled = isFsrsEnabled();

  if (rawEnabled && !schemaReady) {
    console.warn(
      "[fsrs] FSRS_ENABLED=true, но FSRS_SCHEMA_READY не \"true\" — используется legacy-scheduler до применения migration 0032 и установки FSRS_SCHEMA_READY=true.",
    );
  }

  return {
    schemaReady,
    enabled: schemaReady && rawEnabled,
    shadowEnabled: schemaReady,
  };
}
