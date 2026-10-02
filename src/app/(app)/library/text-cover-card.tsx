import Link from "next/link";
import { CoverArt } from "@/components/product/cover-art";

// docs/PRODUCT_ENGAGEMENT_2026-07-28.html, "Библиотека": системные тексты — сетка
// обложек (уровень-бейдж + название на цветной плашке), а не список строк.
export default function TextCoverCard({
  id,
  title,
  levelTag,
}: {
  id: string;
  title: string;
  levelTag: string | null;
}) {
  return (
    <Link
      href={`/read/${id}`}
      className="group relative flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-2xl p-3 text-white transition-transform hover:scale-[1.02]"
    >
      {/* Phase 7: иллюстрированная обложка. Системные тексты — без видео. */}
      <CoverArt title={title} angle={135} />
      {levelTag && (
        <span className="relative self-start rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur-sm">
          {levelTag}
        </span>
      )}
      <p className="relative line-clamp-2 text-sm font-semibold leading-tight">{title}</p>
    </Link>
  );
}
