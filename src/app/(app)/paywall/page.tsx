import { redirect } from "next/navigation";

export default async function PaywallRedirect({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  redirect(reason ? `/pricing?reason=${reason}` : "/pricing");
}
