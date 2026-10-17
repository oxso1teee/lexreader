import { notFound } from "next/navigation";
import { MOMENT_FIXTURES } from "@/lib/moments/fixtures";
import MomentsGallery from "./gallery";

// Галерея моментов с тестовыми данными: для разработки и скриншот-сверки
// с макетами (scripts/moments-snap.ts). В проде закрыта, если явно не
// включена MOMENTS_GALLERY=1 (например, на preview-деплое).
export const metadata = { robots: { index: false, follow: false } };

export default async function DevMomentsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.MOMENTS_GALLERY !== "1") notFound();
  const { m } = await searchParams;
  return <MomentsGallery names={Object.keys(MOMENT_FIXTURES)} open={m && m in MOMENT_FIXTURES ? m : null} />;
}
