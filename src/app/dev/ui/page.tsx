import { notFound } from "next/navigation";
import { connection } from "next/server";
import UiGallery from "./gallery";

// Справочник библиотеки src/components/ui со всеми состояниями — основа для
// ручной сверки с макетами (Ultimate Design System) и для Playwright-тестов
// e2e-ui/ (рендер, клавиатура, a11y, обе темы, адаптив). Открыта локально и
// на preview-деплоях, как /dev/screens и /dev/moments.
export const metadata = { title: "UI kit · LexReader", robots: { index: false, follow: false } };

export default async function DevUiPage() {
  // Без этого страница пререндерится на сборке, и проверка окружения ниже
  // «запекается» (404 на проде навсегда, даже с MOMENTS_GALLERY=1 при старте).
  await connection();
  const isLiveSite = process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";
  if (isLiveSite && process.env.MOMENTS_GALLERY !== "1") notFound();
  return <UiGallery />;
}
