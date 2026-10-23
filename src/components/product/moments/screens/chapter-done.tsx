"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import type { ChapterDoneMoment } from "@/lib/moments/types";
import { MomentScreen } from "../moment-screen";

// Эталон: docs/moments/mockups/Chapter-done.dc.html. "Понимание %" из
// макета опущено — в схеме нет честной метрики понимания текста (не
// выдумываем число); wordsRead/newWordsCount — реальные значения сессии
// чтения из finishReading() (read/[textId]/actions.ts).
export function ChapterDoneScreen({ moment, onClose }: { moment: ChapterDoneMoment; onClose: () => void }) {
  return (
    <MomentScreen
      title={`${moment.textTitle} прочитан`}
      background="var(--sky)"
      foreground="#fff"
      onClose={onClose}
      footerDelay={1}
      footer={
        moment.nextTextId ? (
          <ButtonLink href={`/read/${moment.nextTextId}`} onClick={onClose} variant="leaf" className="mo-cta">
            Следующая часть
          </ButtonLink>
        ) : (
          <Button className="mo-cta" onClick={onClose}>
            Отлично
          </Button>
        )
      }
    >
      <div style={{ textAlign: "center", paddingTop: 76 }}>
        <p className="mo-rise" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.85 }}>
          {moment.collectionTitle}
        </p>
        <h2 className="mo-disp mo-rise" style={{ margin: "8px 28px 0", fontSize: 26, lineHeight: 1.15, fontWeight: 900 }}>
          Часть {moment.chapterPosition} прочитана
        </h2>
      </div>

      <div className="mo-card mo-rise" style={{ margin: "22px 20px 0", padding: "14px 8px", display: "flex", color: "var(--text-primary)" }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div className="mo-disp" style={{ fontSize: 22, fontWeight: 900, color: "var(--color-forest-text)" }}>{moment.wordsRead}</div>
          <div className="mo-muted" style={{ fontSize: 12, marginTop: 4 }}>слов прочитано</div>
        </div>
        <div style={{ width: 2, background: "var(--border)" }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <div className="mo-disp" style={{ fontSize: 22, fontWeight: 900, color: "var(--sky-text)" }}>{moment.newWordsCount}</div>
          <div className="mo-muted" style={{ fontSize: 12, marginTop: 4 }}>новых слов</div>
        </div>
      </div>
    </MomentScreen>
  );
}
