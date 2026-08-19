import { requireProfile } from "@/lib/auth";
import PageHeader from "@/components/product/page-header";
import SpeakClient from "./speak-client";

export default async function SpeakStudioPage() {
  const profile = await requireProfile();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <PageHeader title="Speak Studio" />
      <SpeakClient targetLanguage={profile.target_language} />
    </div>
  );
}
