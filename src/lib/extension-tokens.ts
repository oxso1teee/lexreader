import { randomBytes, createHash } from "node:crypto";
// Relative import, not the "@/..." alias — this file's pure functions
// (generateExtensionToken/hashToken/last4) are exercised directly by
// extension-tokens.test.ts under plain `node --experimental-strip-types`,
// which has no bundler/tsconfig-paths resolution for "@/..." at runtime
// (see src/app/api/webhooks/stripe/route.test.ts's own comment on this).
import { createServiceClient } from "./supabase/service.ts";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "тап-перевод на любой странице". Контент-скрипт на произвольном сайте не
// имеет открытой сессии LexReader (нет cookie, часто нет даже открытой
// вкладки LexReader вообще) — он аутентифицируется персональным API-
// токеном, который пользователь один раз генерирует на /settings и
// вставляет в popup расширения. supabase/migrations/0048_extension_api_tokens.sql.
//
// Токен хранится ТОЛЬКО как sha256-хэш (тот же принцип, что у GitHub
// Personal Access Token / большинства session-token схем) — plaintext
// возвращается пользователю один раз, в момент создания, и никогда больше
// не читается обратно из БД. Компрометация БД не даёт злоумышленнику
// готовые к использованию токены.
const TOKEN_PREFIX = "lxr_ext_";
const TOKEN_BYTES = 32;

export interface ExtensionTokenOwner {
  ownerId: string;
  tokenId: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Генерирует новый plaintext-токен вида "lxr_ext_<44 base64url-символа>". */
export function generateExtensionToken(): string {
  return TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString("base64url");
}

export function last4(token: string): string {
  return token.slice(-4);
}

export { hashToken };

/**
 * Проверяет заголовок Authorization: Bearer <token> расширения. Использует
 * service_role (у запроса извне нет auth.uid() — это не Supabase-сессия),
 * поэтому владелец возвращается явно и все дальнейшие запросы должны сами
 * фильтровать по нему (RLS тут не применяется).
 *
 * Best-effort обновляет last_used_at — ошибка обновления не должна ронять
 * сам запрос перевода.
 */
export async function verifyExtensionToken(authorizationHeader: string | null): Promise<ExtensionTokenOwner | null> {
  if (!authorizationHeader?.startsWith("Bearer ")) return null;
  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const service = createServiceClient();
  const { data: row } = await service
    .from("extension_api_tokens")
    .select("id, owner_id")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!row) return null;

  // Best-effort — a hiccup updating this bookkeeping column must never fail the actual
  // translate-and-save request that's already been authenticated above.
  await service
    .from("extension_api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id)
    .then(
      () => {},
      () => {},
    );

  return { ownerId: row.owner_id, tokenId: row.id };
}
