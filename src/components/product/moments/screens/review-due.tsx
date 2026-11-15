"use client";

import { Button } from "@/components/ui/button";
import type { ReviewDueMoment } from "@/lib/moments/types";
import { MomentScreen } from "../moment-screen";

// Эталон: docs/moments/mockups/Review-due.dc.html. В макете — нижняя
// шторка со забывающей кривой; здесь — тот же MomentScreen, что у всех
// остальных моментов (единый, уже проверенный accessibility-контракт:
// фокус-ловушка, Esc, системное "назад"), кривая забывания опущена как
// чисто декоративная, dueCount — настоящий getDueCount().
export function ReviewDueScreen({ moment, onClose }: { moment: ReviewDueMoment; onClose: () => void }) {
  return (
    <MomentScreen
      title="Пора повторить слова"
      haptic="light"
      onClose={onClose}
      footerDelay={0.6}
      footer={
        <Button className="mo-cta" onClick={onClose}>
          Повторить сейчас
        </Button>
      }
    >
      <div style={{ textAlign: "center", paddingTop: 96 }}>
        <svg viewBox="0 0 128 150" width="84" height="98" aria-hidden="true" style={{ margin: "0 auto" }}>
          <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--color-forest)" />
          <path
            d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z"
            fill="var(--color-forest-tint)"
            opacity="0.9"
          />
        </svg>
        <h2 className="mo-disp mo-rise" style={{ margin: "18px 24px 0", fontSize: 24, lineHeight: 1.2, fontWeight: 900 }}>
          {moment.dueCount} {moment.dueCount === 1 ? "слово начинает" : "слов начинают"} забываться
        </h2>
        <p className="mo-muted mo-rise" style={{ margin: "10px 30px 0", fontSize: 15 }}>
          Повтори сейчас, и они продержатся дольше
        </p>
      </div>
    </MomentScreen>
  );
}
