import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";

export default async function Home() {
  const profile = await getProfile();
  redirect(profile ? "/library" : "/onboarding");
}
