import { createClient } from "@supabase/supabase-js";
import { test, expect, type Page } from "@playwright/test";
import { signUpFreshAccount, completeOnboardingForTest } from "./helpers";

// test-gap-map.md / release-blockers.md P1 #5: YouTube import had no e2e —
// only unit coverage of the transcript logic (src/lib/youtube-ingestion/
// *.test.ts, incl. service.test.ts which drives runYoutubeImport() against
// an in-memory fake Supabase). This covers the real server-side + DB path
// end to end against a real local Postgres, including the atomic
// persist_youtube_import() RPC that has ZERO real-DB coverage today.
//
// WHAT IS AND ISN'T REAL HERE
// The only production YouTube ingestion path is the browser-bridge one
// (src/app/(app)/library/new/youtube-import-form.tsx): a Chrome extension
// ("LexReader Bridge") opens the video on youtube.com, scrapes the
// transcript panel, and hands the result back to the page via a
// window.postMessage protocol. The parked server-worker path
// (startYoutubeImportAction) has no callers and isn't deployed.
//
// That extension boundary — scraping youtube.com's DOM, subject to YT
// anti-bot, markup drift, and needing an unpacked extension loaded into the
// browser — cannot run reliably in CI. So this test stubs EXACTLY that
// boundary (the postMessage handshake) via addInitScript, and nothing else.
// Everything downstream of "a transcript object exists" is the real
// first-party pipeline, exercised for real:
//   real form -> real startYoutubeImportFromBrowserAction server action ->
//   real runYoutubeImport (extractVideoId, per-user hourly rate limit,
//   reserveImportRow dedup + texts insert under RLS) -> real
//   persist_youtube_import RPC (one Postgres transaction, runs as the
//   authenticated user, owner-scoped) -> real caption_segments rows ->
//   real redirect -> real /watch/[textId] render.
// This is the same injection seam the codebase designed for tests (§18 of
// the Slice 12 brief) and the same shape the form itself uses (it wraps the
// extension's result in a synchronous callWorker).

const VIDEO_ID = "jNQXAC9IVRw"; // "Me at the zoo" — real id, valid per video-id.ts
const VIDEO_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
const TITLE = "E2E Zoo Transcript";
const SEGMENTS = [
  { startMs: 0, endMs: 3_000, text: "All right, so here we are in front of the elephants." },
  { startMs: 3_000, endMs: 8_000, text: "The cool thing about these guys is that they have really long trunks." },
  { startMs: 8_000, endMs: 15_000, text: "And that's cool. And that's pretty much all there is to say." },
];

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
}

async function getUserIdByEmail(service: ReturnType<typeof serviceClient>, email: string): Promise<string> {
  const { data } = await service.auth.admin.listUsers({ page: 1, perPage: 10_000 });
  const user = data?.users.find((u) => u.email === email);
  if (!user) throw new Error(`no auth user found for ${email}`);
  return user.id;
}

// Stand in for the LexReader Bridge extension: answer the page's PING with
// READY, and answer a TRANSCRIPT_REQUEST with the given canned result. This
// is the ONLY thing faked — it replaces youtube.com DOM scraping, not any
// LexReader code.
async function installFakeBridge(
  page: Page,
  response: { ok: true; transcript: unknown } | { ok: false; error: string },
) {
  await page.addInitScript(
    ([resp, videoId]) => {
      const BRIDGE_SOURCE = "lexreader-youtube-bridge";
      window.addEventListener("message", (event: MessageEvent) => {
        if (event.source !== window || event.origin !== window.location.origin) return;
        const data = event.data as { source?: string; type?: string; requestId?: string } | null;
        if (data?.source !== "lexreader-web") return;

        if (data.type === "LEXREADER_YOUTUBE_BRIDGE_PING") {
          window.postMessage(
            { source: BRIDGE_SOURCE, type: "LEXREADER_YOUTUBE_BRIDGE_READY" },
            window.location.origin,
          );
          return;
        }
        if (data.type === "LEXREADER_YOUTUBE_TRANSCRIPT_REQUEST") {
          const r = resp as Record<string, unknown>;
          window.postMessage(
            {
              source: BRIDGE_SOURCE,
              type: "LEXREADER_YOUTUBE_TRANSCRIPT_RESPONSE",
              requestId: data.requestId,
              ok: r.ok,
              transcript: r.ok
                ? { videoId, ...(r.transcript as Record<string, unknown>) }
                : undefined,
              error: r.ok ? undefined : r.error,
            },
            window.location.origin,
          );
        }
      });
    },
    [response, VIDEO_ID] as const,
  );
}

test("YouTube import: bridge transcript -> real server pipeline -> texts + caption_segments -> Watch Mode", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const service = serviceClient();

  const email = await signUpFreshAccount(page);
  await completeOnboardingForTest(email);
  const userId = await getUserIdByEmail(service, email);

  await installFakeBridge(page, {
    ok: true,
    transcript: {
      title: TITLE,
      languageCode: "en",
      durationMs: 19_000,
      source: "browser_bridge",
      segments: SEGMENTS,
    },
  });

  let textId: string | undefined;
  try {
    await page.goto("/library/new");
    await page.getByRole("tab", { name: "YouTube" }).click();
    await expect(page.getByText("LexReader Bridge подключён.")).toBeVisible({ timeout: 10_000 });

    await page.locator("#youtube-import-url").fill(VIDEO_URL);
    await page.getByRole("button", { name: /Импортировать субтитры|Сохраняем текст/ }).click();

    await expect(page).toHaveURL(/\/watch\/[\w-]+$/, { timeout: 30_000 });
    textId = page.url().match(/\/watch\/([\w-]+)$/)![1];

    // --- The imported captions render in Watch Mode. ---
    await expect(page.getByText("really long trunks", { exact: false })).toBeVisible({ timeout: 15_000 });

    // --- texts row: youtube source, ready, owned by the server-derived profile. ---
    const { data: row } = await service.from("texts").select("*").eq("id", textId).single();
    expect(row!.owner_id, "owner_id is the authenticated user, never client-supplied").toBe(userId);
    expect(row!.source_type).toBe("youtube");
    expect(row!.youtube_video_id).toBe(VIDEO_ID);
    expect(row!.processing_status).toBe("ready");
    expect(row!.processing_error).toBeNull();
    expect(row!.title).toBe(TITLE);
    expect(row!.transcript_source).toBe("browser_bridge");
    expect(row!.language).toBe("en");
    expect(Number(row!.word_count)).toBeGreaterThan(20);

    // --- caption_segments: every segment, in order, timestamps intact. ---
    const { data: segs } = await service
      .from("caption_segments")
      .select("start_ms, end_ms, body, segment_index")
      .eq("text_id", textId)
      .order("segment_index", { ascending: true });
    expect(segs).toHaveLength(SEGMENTS.length);
    expect(segs!.map((s) => s.segment_index)).toEqual([0, 1, 2]);
    expect(segs![0].body).toContain("elephants");
    expect(Number(segs![1].start_ms)).toBe(3_000);
    expect(Number(segs![2].end_ms)).toBe(15_000);

    // --- Dedup: importing the same video again reuses the one row. ---
    await page.goto("/library/new");
    await page.getByRole("tab", { name: "YouTube" }).click();
    await expect(page.getByText("LexReader Bridge подключён.")).toBeVisible({ timeout: 10_000 });
    await page.locator("#youtube-import-url").fill(VIDEO_URL);
    await page.getByRole("button", { name: /Импортировать субтитры|Сохраняем текст/ }).click();
    await expect(page).toHaveURL(/\/watch\/[\w-]+$/, { timeout: 30_000 });
    const { count: rowCount } = await service
      .from("texts")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("youtube_video_id", VIDEO_ID);
    expect(rowCount, "no duplicate texts row for the same (owner, video)").toBe(1);

    // --- Security: another user cannot open this imported video. ---
    const otherContext = await page.context().browser()!.newContext();
    const otherPage = await otherContext.newPage();
    try {
      const otherEmail = await signUpFreshAccount(otherPage);
      await completeOnboardingForTest(otherEmail);
      await otherPage.goto(`/watch/${textId}`);
      await expect(otherPage.getByText("really long trunks")).toHaveCount(0);
      await expect(otherPage.locator("body")).toContainText("404");
    } finally {
      await otherContext.close();
    }
  } finally {
    if (textId) await service.from("texts").delete().eq("id", textId);
  }
});

test("YouTube import: a malformed transcript from the bridge is rejected and nothing is persisted", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const service = serviceClient();

  const email = await signUpFreshAccount(page);
  await completeOnboardingForTest(email);
  const userId = await getUserIdByEmail(service, email);

  // Bridge "succeeds" but hands back an invalid transcript (no segments) —
  // assertValidTranscriptResult must reject it before any texts row is written.
  await installFakeBridge(page, {
    ok: true,
    transcript: { title: TITLE, languageCode: "en", source: "browser_bridge", segments: [] },
  });

  await page.goto("/library/new");
  await page.getByRole("tab", { name: "YouTube" }).click();
  await expect(page.getByText("LexReader Bridge подключён.")).toBeVisible({ timeout: 10_000 });
  await page.locator("#youtube-import-url").fill(VIDEO_URL);
  await page.getByRole("button", { name: /Импортировать субтитры|Сохраняем текст/ }).click();

  await expect(page.locator('p[role="alert"]')).toContainText(/некорректные субтитры|Не удалось/i, { timeout: 20_000 });
  await expect(page).toHaveURL(/\/library\/new$/);

  const { count } = await service
    .from("texts")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("youtube_video_id", VIDEO_ID);
  expect(count ?? 0, "no texts row created from a rejected transcript").toBe(0);
});
