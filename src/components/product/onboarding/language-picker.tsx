"use client";

import { Check, Search } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { joinLanguageWaitlist, type WaitlistState } from "@/app/onboarding/waitlist-actions";
import { Badge, Button, ChoiceCard, Input } from "@/components/ui";
import { LANGUAGES, READY_LANGUAGES } from "@/lib/languages";

// Раздел 5 промта 2026-07-30 (запуск): библиотека готова только для
// английского — вместо выбора языка без контента открываем лист ожидания.
// Карточка «Скоро» разворачивается в форму с почтой (insert-only, RLS открыт
// для anon/authenticated — supabase/migrations/0029_language_waitlist.sql).
function WaitlistLanguageCell({ code, name }: { code: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, formAction, pending] = useActionState<WaitlistState, FormData>(joinLanguageWaitlist, {});

  if (state.ok) {
    return (
      <div role="status" className="choice-card choice-card-static">
        <span className="choice-card-body">
          <span className="choice-card-label">{name}</span>
          <span className="choice-card-desc">Сообщим, когда будет готово</span>
        </span>
        <Check aria-hidden="true" className="h-5 w-5 flex-none text-[var(--leaf-text)]" />
      </div>
    );
  }

  if (open) {
    return (
      <form
        action={formAction}
        className="col-span-2 flex flex-col gap-3 rounded-[var(--radius-btn)] border-2 border-[var(--border-strong)] bg-[var(--surface)] p-3"
      >
        <input type="hidden" name="language" value={code} />
        <Input
          label={`${name} — оставь почту, сообщим, когда будет готово`}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          requiredMark={false}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={state.error}
        />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button type="submit" size="sm" loading={pending} className="flex-1">
            Сообщить мне
          </Button>
        </div>
      </form>
    );
  }

  return (
    <button type="button" onClick={() => setOpen(true)} className="choice-card">
      {/* Бейдж под названием, а не в одной строке с ним: в двух узких колонках
          «Французский» + «Скоро» не помещались, и слово рвалось посередине. */}
      <span className="choice-card-body">
        <span className="choice-card-label">{name}</span>
        <Badge tone="ink" className="mt-1 self-start">
          Скоро
        </Badge>
      </span>
    </button>
  );
}

// Выбор языка: поиск + карточки (радио). restrictToReady — для изучаемого
// языка: неготовые языки превращаются в карточки «Скоро» с листом ожидания.
export function LanguagePicker({
  name,
  legend,
  value,
  onChange,
  exclude,
  restrictToReady,
}: {
  name: string;
  legend: string;
  value: string;
  onChange: (code: string) => void;
  exclude?: string;
  restrictToReady?: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LANGUAGES.filter((l) => l.code !== exclude).filter((l) => !q || l.name.toLowerCase().includes(q));
  }, [query, exclude]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        aria-label="Поиск языка"
        type="search"
        placeholder="Поиск языка…"
        autoComplete="off"
        icon={<Search />}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {filtered.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--text-secondary)]">Ничего не найдено — попробуй другой запрос.</p>
      ) : (
        // Список прокручивается внутри, а кнопка «Далее» остаётся в экране: высота
        // зависит от экрана (на низком телефоне — меньше, на высоком — до 30rem).
        <fieldset className="choice-group choice-group-2 max-h-[min(30rem,calc(100dvh-22rem))] overflow-y-auto">
          <legend className="sr-only">{legend}</legend>
          {filtered.map((l) =>
            restrictToReady && !READY_LANGUAGES.includes(l.code) ? (
              <WaitlistLanguageCell key={l.code} code={l.code} name={l.name} />
            ) : (
              <ChoiceCard key={l.code} name={name} value={l.code} label={l.name} checked={value === l.code} onChange={onChange} />
            ),
          )}
        </fieldset>
      )}
    </div>
  );
}
