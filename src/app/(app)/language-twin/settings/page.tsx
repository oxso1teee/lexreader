import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateSettingsSafe } from "@/lib/language-twin/settings";
import LanguageTwinUnavailable from "@/components/product/language-twin/unavailable";
import LanguageTwinSubHeader from "../sub-header";
import SettingsForm from "./settings-form";

export default async function LanguageTwinSettingsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const settings = await getOrCreateSettingsSafe(supabase, profile.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <LanguageTwinSubHeader title="Настройки профиля" description="Полный контроль над тем, что видит и хранит Мой английский" />
      {settings ? <SettingsForm settings={settings} /> : <LanguageTwinUnavailable />}
    </div>
  );
}
