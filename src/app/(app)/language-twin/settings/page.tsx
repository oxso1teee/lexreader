import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateSettings } from "@/lib/language-twin/settings";
import PageHeader from "@/components/product/page-header";
import LanguageTwinNav from "../language-twin-nav";
import SettingsForm from "./settings-form";

export default async function LanguageTwinSettingsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const settings = await getOrCreateSettings(supabase, profile.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <PageHeader title="Настройки и приватность" description="Полный контроль над тем, что видит и хранит Language Twin" />
      <LanguageTwinNav current="/language-twin/settings" />
      <SettingsForm settings={settings} />
    </div>
  );
}
