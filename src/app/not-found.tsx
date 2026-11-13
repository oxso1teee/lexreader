import { NotFoundState } from "@/components/ui/states";

// До Phase 1 в приложении не было своей 404 — показывалась стандартная
// страница Next.js вне дизайн-системы. Рендерится внутри корневого layout
// (тема, шрифты, Toaster), поэтому работает и для залогиненных, и для
// гостей; ссылка «На главную» — /home (для гостя proxy/layout сам
// перенаправит на вход).
export const metadata = { title: "Страница не найдена · LexReader" };

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6">
      <NotFoundState />
    </div>
  );
}
