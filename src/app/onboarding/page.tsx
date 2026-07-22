import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import OnboardingWizard from "./onboarding-wizard";

export default async function OnboardingPage() {
  const profile = await getProfile();
  if (profile) {
    redirect("/home");
  }

  return <OnboardingWizard />;
}
