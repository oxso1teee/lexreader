import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSrsSettings } from "@/lib/srs-settings";
import SettingsForm from "./settings-form";

export default async function StudySettingsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const settings = await getSrsSettings(supabase, profile.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <div className="flex items-center gap-3">
        <Link href="/brain" className="text-[var(--color-caramel-text)]">
          ← Назад
        </Link>
        <h1 className="text-xl font-bold">Настройки повторения</h1>
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}
