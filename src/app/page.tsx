import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import LandingPage from "./landing-page";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <LandingPage />;

  const profile = await getProfile();
  redirect(profile ? "/home" : "/onboarding");
}
