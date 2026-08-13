import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "test@example.com";
const TEST_PASSWORD = "newtestpass456";

function loadEnvLocal() {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

// P0-АУДИТ 3.22: делает набор самодостаточным для CI — на свежей базе
// (после supabase start + миграций + seed) тестового пользователя ещё нет.
// Раньше он создавался вручную один раз, и весь набор молча зависел от
// этого локального состояния.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureTestUser(supabase: any) {
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  let userId = created?.user?.id;
  if (createError) {
    // Уже существует (обычный случай при повторных локальных прогонах) —
    // находим существующего пользователя вместо падения.
    const { data: list } = await supabase.auth.admin.listUsers();
    userId = list?.users.find((u: { email?: string }) => u.email === TEST_EMAIL)?.id;
  }
  if (!userId) return;

  // M3 Slice 9: completed_first_win: true here matters far beyond onboarding
  // itself — src/app/(app)/layout.tsx now gates every (app) route on this
  // flag, so a false value would redirect this shared test account into
  // /onboarding/** instead of /home on every login() across the entire e2e
  // suite. This account is meant to represent an existing, already-onboarded
  // user (docs/ui/m3-slice9-onboarding-placement-v2-plan.md §11
  // grandfathering) — new-account/onboarding-specific behavior gets its own
  // signUpFreshAccount()-based tests instead.
  await supabase.from("profiles").upsert({
    id: userId,
    target_language: "en",
    native_language: "ru",
    level: "intermediate",
    daily_word_goal: 10,
    completed_first_win: true,
  });

  const { data: existingDeck } = await supabase
    .from("decks")
    .select("id")
    .eq("owner_id", userId)
    .eq("is_default", true)
    .maybeSingle();
  if (!existingDeck) {
    // РЕАЛЬНЫЙ БАГ (найден при диагностике CI-падений ensureDueCard()):
    // decks.language — text NOT NULL без default с миграции 0018 (см.
    // 0018_brain_language.sql), а этот insert никогда его не заполнял и не
    // проверял ошибку. На моей локальной БД "Основная колода" пережила эту
    // миграцию (создана раньше неё), так что ветка `if (!existingDeck)`
    // здесь никогда больше не выполнялась — бага была скрыта много месяцев.
    // На свежей CI-базе (`supabase db reset`) деки ещё нет, insert реально
    // выполняется и падает на NOT NULL constraint, молча — ensureDueCard()
    // затем не находит вообще никакой default-колоды.
    const { error } = await supabase
      .from("decks")
      .insert({ owner_id: userId, name: "Основная колода", is_default: true, language: "en" });
    if (error) console.error("[ensureTestUser] insert default deck failed:", error);
  }
}

// M3 Slice 4: practice-brain-a11y.spec.ts стартует настоящую сессию
// повторения на test@example.com — каждый прогон (или ручная проверка тем же
// аккаунтом) переносит due_at "birds" в будущее, и следующий прогон находит
// пустую очередь. reader-library-a11y.spec.ts полагается на тот же
// сидированный флеш-карт как "always due" — без явного сброса здесь оба
// набора рано или поздно начинают молча ловить пустое состояние вместо
// экрана повторения.
//
// CI-БАГ (найден при первом реальном прогоне полного набора в GitHub
// Actions): "birds" — это просто слово в тексте seed.sql ("A Walk in the
// Park"), не отдельно засеянная флеш-карта. Она превращается в реальную
// строку flashcards только когда КТО-ТО реально тапнул по ней в Reader —
// на моей долгоживущей локальной БД это уже случилось много раз, поэтому
// .maybeSingle() ниже раньше молча находил её. На свежей БД CI
// (`supabase db reset`) её взять неоткуда: reader-library-a11y.spec.ts
// (единственный тест, который её создаёт) идёт по алфавиту ПОСЛЕ
// practice-brain-a11y.spec.ts, так что до первого её прогона "birds"-карты
// физически не существует ни для одного более раннего теста. Раньше эта
// функция при отсутствии карты просто выходила (`if (!card) return`) —
// теперь создаёт её напрямую, не полагаясь на порядок файлов/историю БД.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureDueCard(supabase: any, userId: string) {
  const pastDueAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: card, error: findError } = await supabase
    .from("flashcards")
    .select("id")
    .eq("owner_id", userId)
    .eq("front", "birds")
    .maybeSingle();
  if (findError) console.error("[ensureDueCard] find flashcard failed:", findError);

  if (card) {
    const { error: updateError } = await supabase
      .from("srs_state")
      .update({ due_at: pastDueAt })
      .eq("flashcard_id", card.id);
    if (updateError) console.error("[ensureDueCard] update srs_state failed:", updateError);
    else console.log("[ensureDueCard] reused existing 'birds' flashcard", card.id);
    return;
  }

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("id")
    .eq("owner_id", userId)
    .eq("is_default", true)
    .maybeSingle();
  if (deckError) console.error("[ensureDueCard] find default deck failed:", deckError);
  if (!deck) {
    console.error("[ensureDueCard] no default deck found for", userId, "— aborting");
    return;
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("target_language")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) console.error("[ensureDueCard] find profile failed:", profileError);

  // M3 Slice 10 (task #281, found while running the new vocabulary-privacy e2e spec):
  // flashcards.normalized_key (migration 0041) is NOT NULL with no default — item_type/
  // source_type both have real defaults ('word'/'manual'), normalized_key does not. This raw
  // insert predates that migration and silently failed on a fresh (supabase db reset) database
  // once the column landed, same shape as the pre-existing decks.language bug documented above.
  const { data: inserted, error: insertError } = await supabase
    .from("flashcards")
    .insert({
      owner_id: userId,
      deck_id: deck.id,
      front: "birds",
      back: "птицы",
      language: profile?.target_language ?? "en",
      normalized_key: "birds",
    })
    .select("id")
    .single();
  if (insertError) console.error("[ensureDueCard] insert flashcard failed:", insertError);
  if (!inserted) return;
  const { error: srsInsertError } = await supabase
    .from("srs_state")
    .insert({ flashcard_id: inserted.id, due_at: pastDueAt });
  if (srsInsertError) console.error("[ensureDueCard] insert srs_state failed:", srsInsertError);
  else console.log("[ensureDueCard] created new 'birds' flashcard", inserted.id);
}

// Тесты в этом наборе логинятся много раз подряд (несколько spec-файлов,
// один процесс) — без сброса это само упирается в наш же rate-limit на
// вход (P0-AUTH-04), который иначе рассчитан на реальных пользователей за
// 15 минут, а не на прогон тестов за пару минут.
export default async function globalSetup() {
  loadEnvLocal();
  const supabase: ReturnType<typeof createClient> = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
  await ensureTestUser(supabase);
  await supabase.from("auth_attempts").delete().gte("id", 0);

  // Несколько спек-файлов создают свою тестовую колоду на каждый прогон
  // (brain-notebook.spec.ts, unified-shell-today.spec.ts,
  // unified-shell-progress-settings.spec.ts, brain-undo-rename.spec.ts) —
  // без очистки они копятся и рано или поздно упираются в FREE_DECK_LIMIT=3
  // (P0-6.3), заставляя ЛЮБОЙ следующий тест, создающий колоду, попасть на
  // paywall-ветку вместо формы создания. Четыре отдельных .like() вместо
  // одного .or() — синтаксис wildcard внутри сырых .or()-фильтров PostgREST
  // (`*`) отличается от .like() (`%`), не стоит рисковать тихо не находящим
  // совпадений фильтром.
  for (const pattern of ["E2E Deck %", "Today CTA %", "Progress insight %", "E2E Rename %"]) {
    await supabase.from("decks").delete().like("name", pattern);
  }

  const { data: users } = await supabase.auth.admin.listUsers();
  const userId = users?.users.find((u: { email?: string }) => u.email === TEST_EMAIL)?.id;
  if (userId) await ensureDueCard(supabase, userId);
}
