"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createFriendStreakInviteAction } from "../actions";

// Тот же паттерн copy-link, что duel-room.tsx::handleCopyLink — только
// здесь сама ссылка создаётся лениво по клику, а не сразу при заходе на
// страницу (иначе каждый reload плодил бы новую приглашённую пару-заготовку).
export default function InviteCard() {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    const result = await createFriendStreakInviteAction();
    setBusy(false);
    if (!result.ok || !result.inviteUrl) {
      setError(result.error ?? "Что-то пошло не так, попробуй ещё раз.");
      return;
    }
    setInviteUrl(result.inviteUrl);
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card as="section" className="p-6 text-center">
      {error && (
        <p role="alert" className="mb-3 rounded-2xl border border-[var(--color-danger-text)]/25 bg-[var(--color-danger-text)]/10 p-3 text-body-sm text-[var(--color-danger-text)]">
          {error}
        </p>
      )}

      {!inviteUrl ? (
        <Button variant="leaf" disabled={busy} onClick={handleCreate}>
          {busy ? "…" : "Создать ссылку-приглашение"}
        </Button>
      ) : (
        <div className="mx-auto flex max-w-sm items-center gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-[var(--background)] px-2 py-1.5 text-caption whitespace-nowrap">{inviteUrl}</code>
          <Button variant="leaf" size="sm" onClick={handleCopy} className="min-h-11 shrink-0 gap-1 px-3">
            {copied ? "Скопировано" : "Копировать"}
            {copied && <Check aria-hidden="true" className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </Card>
  );
}
