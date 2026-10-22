"use client";

import { useEffect, useState } from "react";

// Эталон: docs/moments/mockups/Offline.dc.html. "Доступно офлайн" — не
// выдумка: public/sw.js кеширует (network-first) любую посещённую
// навигацию в CACHE_NAME = "lexreader-shell-v1" (строка захардкожена в
// обоих местах — sw.js не TS-модуль, общую константу не вынести). Читаем
// реальный список кешированных URL через Cache Storage API вместо точных
// названий книг/прогресса (которых без запроса в сеть всё равно не
// получить офлайн честно).
const SHELL_CACHE_NAME = "lexreader-shell-v1";

interface CachedPage {
  url: string;
  label: string;
}

function labelForPath(pathname: string): string {
  if (pathname.startsWith("/read/")) return "Текст в читалке";
  if (/^\/brain\/[^/]+\/review/.test(pathname)) return "Повторение слов";
  if (pathname === "/home") return "Главная";
  if (pathname === "/library") return "Библиотека";
  return pathname;
}

export default function OfflinePage() {
  const [pages, setPages] = useState<CachedPage[]>([]);
  const [checking, setChecking] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("caches" in window)) return;
    caches
      .open(SHELL_CACHE_NAME)
      .then((cache) => cache.keys())
      .then((requests) => {
        const seen = new Set<string>();
        const list: CachedPage[] = [];
        for (const req of requests) {
          const url = new URL(req.url);
          if (url.pathname === "/offline" || seen.has(url.pathname)) continue;
          seen.add(url.pathname);
          list.push({ url: url.pathname, label: labelForPath(url.pathname) });
        }
        setPages(list);
      })
      .catch(() => setPages([]));
  }, []);

  function retry() {
    setChecking(true);
    setTried(false);
    fetch("/", { cache: "no-store" })
      .then(() => window.location.reload())
      .catch(() => {
        setChecking(false);
        setTried(true);
      });
  }

  return (
    <div className="onb-screen mx-auto flex w-full max-w-sm flex-1 flex-col px-6 pt-16 text-center">
      <div className="mo-breathe mx-auto w-fit">
        <svg viewBox="0 0 128 150" width={120} height={140} aria-hidden="true">
          <ellipse cx="64" cy="128" rx="34" ry="9" fill="rgba(0,0,0,0.06)" />
          <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
          <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
          <ellipse cx="54" cy="62" rx="3.4" ry="4.6" fill="var(--leaf-deep)" />
          <ellipse cx="66" cy="62" rx="3.4" ry="4.6" fill="var(--leaf-deep)" />
          <ellipse cx="60" cy="75" rx="3.4" ry="4" fill="var(--leaf-deep)" />
          <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
        </svg>
      </div>
      <h1 className="mt-4 text-[26px] font-black leading-tight">Нет интернета</h1>
      <p className="mt-2.5 text-base leading-relaxed text-[var(--text-secondary)]">
        Не беда: скачанные тексты читаются и без сети. Прогресс отправим, когда связь вернётся
      </p>

      {pages.length > 0 && (
        <div className="mt-5 rounded-[20px] border-2 border-[var(--border)] bg-[var(--surface)] text-left">
          <div className="px-3.5 pt-3 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Доступно офлайн</div>
          {pages.map((p, i) => (
            <a
              key={p.url}
              href={p.url}
              className={`flex items-center gap-3 px-3.5 py-3 text-sm font-semibold ${i < pages.length - 1 ? "border-b border-[var(--border)]" : ""}`}
            >
              <span className="flex-1">{p.label}</span>
              <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true" style={{ color: "var(--leaf-text)" }}>
                <path d="M5 12l5 5L20 7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ))}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2 pb-10 pt-6">
        {tried && !checking && (
          <div role="status" className="mb-1 rounded-xl px-3.5 py-3 text-sm font-semibold text-white" style={{ background: "#1a1a1a" }}>
            Сети пока нет. Попробуем сами через минуту
          </div>
        )}
        <button
          type="button"
          onClick={retry}
          disabled={checking}
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl px-5 font-bold text-white disabled:opacity-80"
          style={{ background: "var(--leaf)", boxShadow: "inset 0 -4px 0 0 var(--leaf-edge)" }}
        >
          {checking ? "Проверяем связь…" : "Проверить снова"}
        </button>
      </div>
    </div>
  );
}
