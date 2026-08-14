import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envText = readFileSync("/home/sergey/Документы/projects/English_teacher_AI/.env.local", "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const email = `gate3-e2e-${Date.now()}@example.com`;
const password = "Gate3Test!2026xyz";

const { data: created, error: createErr } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (createErr) {
  console.error("createUser error:", createErr);
  process.exit(1);
}
const userId = created.user.id;

const { error: profileErr } = await supabase.from("profiles").insert({
  id: userId,
  target_language: "en",
  native_language: "ru",
  completed_first_win: true,
});
if (profileErr) {
  console.error("profile insert error:", profileErr);
  process.exit(1);
}

console.log(JSON.stringify({ email, password, userId }));
