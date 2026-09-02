"use client";

import { useState } from "react";
import SectionHeader from "@/components/product/section-header";
import { track } from "@/lib/posthog-client";
import { createExtensionToken, revokeExtensionToken, type ExtensionTokenSummary } from "./extension-actions";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "тап-перевод на любой странице" через браузерное расширение. Токен
// показывается plaintext ровно один раз, сразу после создания (extension-actions.ts
// хранит только его хэш) — тот же UX, что у GitHub Personal Access Token.
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export default function ExtensionTokensSection({ initialTokens }: { initialTokens: ExtensionTokenSummary[] }) {
  const [tokens, setTokens] = useState(initialTokens);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    setCopied(false);
    const result = await createExtensionToken(label);
    setBusy(false);
    if (!result.ok || !result.token || !result.summary) {
      setError(result.error ?? "Не удалось создать токен.");
      return;
    }
    track("extension_token_created");
    setTokens((prev) => [result.summary!, ...prev]);
    setJustCreated(result.token);
    setLabel("");
  }

  async function handleRevoke(id: string) {
    setBusy(true);
    setError(null);
    const result = await revokeExtensionToken(id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Не удалось отозвать токен.");
      return;
    }
    track("extension_token_revoked");
    setTokens((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleCopy() {
    if (!justCreated) return;
    await navigator.clipboard.writeText(justCreated);
    setCopied(true);
  }

  return (
    <section className="rounded-2xl bg-[var(--surface)] p-4 shadow-sm">
      <SectionHeader title="Браузерное расширение" />
      <p className="text-body-sm mt-2 text-[var(--text-secondary)]">
        Тап по незнакомому слову на любой странице — перевод в контексте и сохранение в словарь,
        как в чтении. Создай токен и вставь его в настройки расширения.
      </p>

      {justCreated && (
        <div className="mt-3 rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning)]/10 p-3">
          <p className="text-body-sm font-semibold text-[var(--color-warning-text)]">
            Токен создан — скопируй сейчас, второй раз не покажем
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-[var(--surface)] px-2 py-1.5 text-caption whitespace-nowrap">
              {justCreated}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="focus-ring flex min-h-11 shrink-0 items-center rounded-full bg-forest px-3 text-body-sm font-medium text-white"
            >
              {copied ? "Скопировано ✓" : "Копировать"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-body-sm mt-2 text-[var(--color-danger-text)]">
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <label htmlFor="extension-token-label" className="sr-only">
          Название токена
        </label>
        <input
          id="extension-token-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Название (необязательно)"
          maxLength={60}
          className="focus-ring min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-body-sm"
        />
        <button
          type="button"
          disabled={busy}
          onClick={handleCreate}
          className="focus-ring flex min-h-11 shrink-0 items-center rounded-full border border-[var(--border-strong)] px-4 text-body-sm font-medium disabled:opacity-50"
        >
          {busy ? "…" : "Создать токен"}
        </button>
      </div>

      {tokens.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 text-body-sm">
              <div>
                <p className="font-medium">
                  {t.label} <span className="text-[var(--text-secondary)]">···{t.last4}</span>
                </p>
                <p className="text-caption text-[var(--text-secondary)]">
                  Создан {formatDate(t.createdAt)}
                  {t.lastUsedAt ? ` · использован ${formatDate(t.lastUsedAt)}` : " · ещё не использован"}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRevoke(t.id)}
                className="focus-ring shrink-0 text-body-sm text-[var(--color-danger-text)] underline disabled:opacity-50"
              >
                Отозвать
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
