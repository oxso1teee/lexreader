"use client";

import { useEffect, useState } from "react";

// Эталон: docs/moments/mockups/Offline.dc.html. "Доступно офлайн" — не
// выдумка: public/sw.js кеширует (network-first) посещённые навигации в
// CACHE_NAME = "lexreader-shell-v1" (строка захардкожена в обоих местах —
// sw.js не TS-модуль). Показываем только то, что реально работает без сети:
// тексты из читалки (название берём из <title> закешированной страницы) и
// повторение слов. Прогресс главы офлайн честно не получить — не пишем.
const SHELL_CACHE_NAME = "lexreader-shell-v1";
const COVERS = ["#0b79b0", "#2b820f", "#c2410c", "#7c3aed", "#b45309"];

interface CachedPage {
  url: string;
  kind: "text" | "review";
  title: string;
}

function coverColor(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) | 0;
  return COVERS[Math.abs(h) % COVERS.length];
}

async function titleFromCache(cache: Cache, req: Request): Promise<string | null> {
  try {
    const res = await cache.match(req);
    if (!res) return null;
    const html = await res.text();
    const m = html.match(/<title>([^<]*)<\/title>/i);
    const t = m?.[1]?.replace(/\s*·\s*LexReader\s*$/, "").trim();
    return t && t !== "LexReader" ? t.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"') : null;
  } catch {
    return null;
  }
}

export default function OfflinePage() {
  const [pages, setPages] = useState<CachedPage[]>([]);
  const [checking, setChecking] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("caches" in window)) return;
    (async () => {
      const cache = await caches.open(SHELL_CACHE_NAME);
      const requests = await cache.keys();
      const seen = new Set<string>();
      const list: CachedPage[] = [];
      let hasReview = false;
      for (const req of requests) {
        const path = new URL(req.url).pathname;
        if (seen.has(path)) continue;
        seen.add(path);
        if (path.startsWith("/read/")) {
          list.push({ url: path, kind: "text", title: (await titleFromCache(cache, req)) ?? "Сохранённый текст" });
        } else if (!hasReview && /^\/brain\/[^/]+\/review/.test(path)) {
          hasReview = true;
          list.push({ url: path, kind: "review", title: "Повтор слов" });
        }
      }
      list.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "text" ? -1 : 1));
      setPages(list.slice(0, 4));
    })().catch(() => setPages([]));
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

  const firstText = pages.find((p) => p.kind === "text");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col bg-background">
      <div style={{ textAlign: "center", paddingTop: 90 }}>
        <div style={{ position: "relative", display: "inline-block", width: 260, height: 170 }} aria-hidden="true">
          <div className="of-sway" style={{ position: "absolute", left: 0, bottom: 0 }}>
            <svg viewBox="0 0 128 150" width="120" height="140">
              <ellipse cx="64" cy="128" rx="34" ry="9" fill="rgba(0,0,0,0.06)" />
              <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
              <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
              <path d="M49 58l8-2M71 58l-8-2" stroke="var(--leaf-edge)" strokeWidth="2.4" strokeLinecap="round" />
              <ellipse cx="54" cy="62" rx="3.4" ry="4.6" fill="var(--leaf-edge)" />
              <ellipse cx="66" cy="62" rx="3.4" ry="4.6" fill="var(--leaf-edge)" />
              <ellipse cx="60" cy="75" rx="3.4" ry="4" fill="var(--leaf-edge)" />
              <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
            </svg>
          </div>
          <svg viewBox="0 0 150 80" width="150" height="80" style={{ position: "absolute", right: 0, bottom: 18 }}>
            <path d="M0 60 C30 60 30 30 60 30 S80 50 92 50" fill="none" stroke="#6b7280" strokeWidth="5" strokeLinecap="round" />
            <g className="of-plug">
              <rect x="92" y="40" width="20" height="20" rx="4" fill="#6b7280" />
              <path d="M112 45h8M112 55h8" stroke="#6b7280" strokeWidth="4" strokeLinecap="round" />
            </g>
            <rect x="134" y="34" width="14" height="32" rx="4" fill="#d6cfc3" />
            <g className="of-spark">
              <path d="M126 32l4 6M128 50h-6M126 68l4-6" stroke="var(--sun)" strokeWidth="3" strokeLinecap="round" />
            </g>
          </svg>
        </div>
        <h1 className="mo-disp mo-rise" style={{ margin: "18px 24px 0", fontSize: 26, lineHeight: 1.2, fontWeight: 900 }}>
          Нет интернета
        </h1>
        <p className="mo-muted mo-rise" style={{ margin: "10px 30px 0", fontSize: 16, lineHeight: 1.45, animationDelay: ".1s" }}>
          Не беда: скачанные тексты читаются и без сети. Прогресс отправим, когда связь вернётся
        </p>
      </div>

      {pages.length > 0 && (
        <div className="mo-card mo-rise" style={{ margin: "22px 20px 0", animationDelay: ".2s" }}>
          <div className="mo-muted" style={{ padding: "12px 14px 0", fontSize: 12, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>
            Доступно офлайн
          </div>
          {pages.map((p, i) => (
            <a key={p.url} href={p.url} className="of-row" style={{ borderBottom: i < pages.length - 1 ? "2px solid var(--border)" : undefined }}>
              {p.kind === "text" ? (
                <div className="of-cover" style={{ background: coverColor(p.url) }} aria-hidden="true">
                  {p.title.toUpperCase().slice(0, 28)}
                </div>
              ) : (
                <div style={{ width: 34, height: 46, borderRadius: 6, background: "var(--sky-tint)", color: "var(--sky-text)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="6" width="14" height="14" rx="2" />
                    <path d="M7 2h12a2 2 0 0 1 2 2v12" />
                  </svg>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                <div className="mo-muted" style={{ fontSize: 12, marginTop: 2 }}>{p.kind === "text" ? "Сохранён на устройстве" : "Карточки на устройстве"}</div>
              </div>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--leaf-text)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </a>
          ))}
        </div>
      )}

      <div className="mo-rise" style={{ marginTop: "auto", padding: "18px 20px 30px", animationDelay: ".35s" }}>
        {tried && !checking && (
          <div className="of-toast" role="status">
            Сети пока нет. Попробуем сами через минуту
          </div>
        )}
        {firstText ? (
          <>
            <a href={firstText.url} className="btn btn-leaf btn-md mo-cta">
              Читать офлайн
            </a>
            <button type="button" className="of-retry" onClick={retry} disabled={checking}>
              {checking && (
                <svg className="of-spin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.2-8.6" />
                </svg>
              )}
              {checking ? "Проверяем связь…" : "Проверить снова"}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-leaf btn-md mo-cta" onClick={retry} disabled={checking}>
            {checking ? "Проверяем связь…" : "Проверить снова"}
          </button>
        )}
      </div>
    </div>
  );
}
