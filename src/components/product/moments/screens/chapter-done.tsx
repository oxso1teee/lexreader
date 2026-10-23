"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ChapterDoneMoment } from "@/lib/moments/types";
import { MomentScreen } from "../moment-screen";
import { useCountUp } from "../use-count-up";

// Эталон: docs/moments/mockups/Chapter-done.dc.html, reference/Chapter-done.png:
// книжка падает и открывается на последней странице главы, три цифры, слова
// главы в карточках. Всё реальное: wordsRead = texts.word_count,
// comprehension = доля слов без подсказки перевода, newWords — сохранённые
// за эту сессию (src/lib/moments/chapter-done.ts).
const SKY_BTN = { ["--btn-fill" as string]: "#0b79b0", ["--btn-edge" as string]: "#075a85", ["--btn-label" as string]: "#fff" };

export function ChapterDoneScreen({ moment, onClose }: { moment: ChapterDoneMoment; onClose: () => void }) {
  const router = useRouter();
  const words = useCountUp(moment.wordsRead, { delay: 1500, duration: 900 });
  const newCount = useCountUp(moment.newWordsCount, { delay: 1600, duration: 700 });
  const pc = useCountUp(moment.comprehension ?? 0, { delay: 1700, duration: 800 });
  const chips = moment.newWords ?? [];
  const rest = Math.max(0, moment.newWordsCount - chips.length);
  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <MomentScreen
      title={`${moment.textTitle} прочитана`}
      onClose={onClose}
      footerDelay={2.8}
      footer={
        <div style={{ display: "flex", gap: 12 }}>
          {moment.newWordsCount > 0 && (
            <Button variant="sky" className="mo-cta" style={{ flex: 1, ...SKY_BTN }} onClick={() => go("/brain/all/review")}>
              Закрепить слова
            </Button>
          )}
          {moment.nextTextId ? (
            <Button className="mo-cta" style={{ flex: 1 }} onClick={() => go(`/read/${moment.nextTextId}`)}>
              Глава {moment.chapterPosition + 1}
            </Button>
          ) : (
            <Button className="mo-cta" style={{ flex: 1 }} onClick={onClose}>
              Отлично
            </Button>
          )}
        </div>
      }
    >
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 76 }}>
        <div className="cd-drop" style={{ position: "relative", width: 140, height: 186 }}>
          <div className="cd-glowb" aria-hidden="true" style={{ position: "absolute", left: -40, top: -30, width: 220, height: 240, borderRadius: 999, background: "var(--sun-tint)" }} />
          <svg className="cd-tw" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style={{ left: -26, top: 10, animationDelay: "1.6s" }}>
            <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="var(--sun)" />
          </svg>
          <svg className="cd-tw" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style={{ right: -24, top: 50, animationDelay: "2s" }}>
            <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="var(--sky)" />
          </svg>
          <div
            aria-hidden="true"
            style={{ position: "absolute", inset: 0, borderRadius: "6px 14px 14px 6px", background: "#fff", border: "2px solid rgba(26,26,26,.15)", padding: "18px 14px", font: "400 9px/1.6 var(--font-reading), serif", color: "rgba(26,26,26,.6)", overflow: "hidden" }}
          >
            {moment.excerpt}
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 12, textAlign: "center", font: "700 11px/1 var(--font-unbounded), sans-serif", color: "var(--leaf)", background: "#fff", paddingTop: 6 }}>
              КОНЕЦ ГЛАВЫ {moment.chapterPosition}
            </div>
          </div>
          <div
            className="cd-cover"
            aria-hidden="true"
            style={{ position: "absolute", inset: 0, borderRadius: "6px 14px 14px 6px", background: "#0b79b0", boxShadow: "inset 6px 0 0 0 #075a85", display: "flex", alignItems: "flex-end", padding: 12, color: "#fff", font: "700 13px/1.15 var(--font-unbounded), sans-serif", textTransform: "uppercase", overflowWrap: "anywhere" }}
          >
            {moment.collectionTitle}
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "26px 28px 0" }}>
        <div className="mo-rise" style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sky-text)", animationDelay: "1.3s" }}>
          {moment.collectionTitle}
        </div>
        <h2 className="mo-disp mo-rise" style={{ margin: "8px 0 0", fontSize: 28, lineHeight: 1.15, fontWeight: 900, animationDelay: "1.35s" }}>
          Глава {moment.chapterPosition} прочитана
        </h2>
      </div>

      <div className="mo-card mo-rise" style={{ margin: "22px 20px 0", padding: "14px 8px", display: "flex", animationDelay: "1.5s" }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div className="mo-disp" style={{ fontSize: 22, fontWeight: 900, color: "var(--leaf-text)" }}>{words.toLocaleString("ru-RU")}</div>
          <div className="mo-muted" style={{ fontSize: 12, marginTop: 4 }}>слов прочитано</div>
        </div>
        <div style={{ width: 2, background: "var(--surface-muted)" }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <div className="mo-disp" style={{ fontSize: 22, fontWeight: 900, color: "var(--sky-text)" }}>{newCount}</div>
          <div className="mo-muted" style={{ fontSize: 12, marginTop: 4 }}>новых слов</div>
        </div>
        {moment.comprehension !== undefined && (
          <>
            <div style={{ width: 2, background: "var(--surface-muted)" }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <div className="mo-disp" style={{ fontSize: 22, fontWeight: 900, color: "var(--sun-text)" }}>{pc}%</div>
              <div className="mo-muted" style={{ fontSize: 12, marginTop: 4 }}>понимание</div>
            </div>
          </>
        )}
      </div>

      {chips.length > 0 && (
        <div className="mo-rise" style={{ padding: "18px 20px 0", animationDelay: "1.7s" }}>
          <div className="mo-muted" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>Слова главы в твоих карточках</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {chips.map((w, i) => (
              <span key={w + i} className="cd-fw" style={{ animationDelay: `${2.2 + i * 0.12}s` }}>
                <span className="cd-wchip">{w}</span>
              </span>
            ))}
            {rest > 0 && (
              <span className="cd-fw" style={{ animationDelay: `${2.2 + chips.length * 0.12}s` }}>
                <span className="cd-wchip" style={{ fontFamily: "var(--font-onest), sans-serif" }}>+{rest}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </MomentScreen>
  );
}
