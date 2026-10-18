import { notFound } from "next/navigation";
import { MOMENT_FIXTURES } from "@/lib/moments/fixtures";
import MomentsGallery from "./gallery";

// Галерея моментов с тестовыми данными: для разработки и скриншот-сверки
// с макетами. Открыта локально и на preview-деплоях Vercel (VERCEL_ENV=
// "preview"), на боевом сайте закрыта, если явно не включена MOMENTS_GALLERY=1.
export const metadata = { robots: { index: false, follow: false } };

export default async function DevMomentsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const isLiveSite = process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";
  if (isLiveSite && process.env.MOMENTS_GALLERY !== "1") notFound();
  const { m } = await searchParams;
  return <MomentsGallery names={Object.keys(MOMENT_FIXTURES)} open={m && m in MOMENT_FIXTURES ? m : null} />;
}
