import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { signUpFreshAccount, completeOnboardingForTest } from "./helpers";

// test-gap-map.md / release-blockers.md P1 #5: PDF import had no e2e — only
// src/lib/file-validation.test.ts unit-tests the magic-byte guard. This
// covers the real user path end to end:
//   /library/new -> Файл/PDF tab -> pick a PDF -> pdf.js extracts the text
//   layer in the browser -> createText() server action -> texts row ->
//   redirect into the Reader, which renders the imported body.
//
// PDF text extraction is 100% client-side (src/app/(app)/library/new/
// pdf-import-form.tsx runs pdf.js in the browser; the server only ever sees
// the extracted `body` string, exactly like the plain "Текст" tab). So the
// server-side security surface for PDF == createText(): owner_id comes from
// requireProfile() (never the client), body is length-bounded, texts RLS
// isolates it. The cross-user check below proves the last point for a
// PDF-imported row specifically.

// Minimal single-page PDF with a real text layer, xref byte-offsets computed
// so pdf.js reads it without falling back to xref reconstruction. Kept inline
// (no binary fixture file, no new dependency) — Playwright's setInputFiles
// takes an in-memory buffer directly.
function makeTextPdf(text: string): Buffer {
  const header = "%PDF-1.4\n";
  const streamInner = `BT /F1 24 Tf 72 700 Td (${text.replace(/([()\\])/g, "\\$1")}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${streamInner.length} >>\nstream\n${streamInner}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "";
  const offsets: number[] = [];
  for (let i = 0; i < objs.length; i++) {
    offsets.push(header.length + body.length);
    body += `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xrefStart = header.length + body.length;
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  const trailer = `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(header + body + xref + trailer, "latin1");
}

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

const PDF_BODY = "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.";

test("PDF import: a real PDF with a text layer is extracted, saved as a texts row, and opens in the Reader", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const service = serviceClient();

  const email = await signUpFreshAccount(page);
  await completeOnboardingForTest(email);
  const userId = await getUserIdByEmail(service, email);

  let textId: string | undefined;
  try {
    await page.goto("/library/new");
    await page.getByRole("tab", { name: "Файл" }).click();
    await page.getByRole("button", { name: "PDF", exact: true }).click();

    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "e2e-sample.pdf", mimeType: "application/pdf", buffer: makeTextPdf(PDF_BODY) });

    // Extraction done -> the editable review form appears, pre-filled.
    const bodyField = page.locator("#pdf-import-body");
    await expect(bodyField).toBeVisible({ timeout: 30_000 });
    await expect(bodyField).toHaveValue(/quick brown fox/, { timeout: 15_000 });
    await expect(page.locator("#pdf-import-title")).toHaveValue("e2e-sample");

    await page.getByRole("button", { name: "Добавить в библиотеку" }).click();

    await expect(page).toHaveURL(/\/read\/[\w-]+$/, { timeout: 15_000 });
    textId = page.url().match(/\/read\/([\w-]+)$/)![1];
    await expect(page.getByText("quick brown fox").first()).toBeVisible();

    // --- Persisted correctly, owned by the server-derived profile. ---
    const { data: row } = await service.from("texts").select("*").eq("id", textId).single();
    expect(row!.owner_id, "owner_id is the authenticated user, not client-supplied").toBe(userId);
    expect(row!.source_type).toBe("manual");
    expect(row!.language).toBe("en");
    expect(String(row!.body)).toContain("quick brown fox");
    expect(Number(row!.word_count)).toBeGreaterThan(5);

    // --- Security: another user cannot open this PDF-imported text. ---
    const otherContext = await page.context().browser()!.newContext();
    const otherPage = await otherContext.newPage();
    try {
      const otherEmail = await signUpFreshAccount(otherPage);
      await completeOnboardingForTest(otherEmail);
      await otherPage.goto(`/read/${textId}`);
      // texts RLS ("owner full access") returns nothing for user B, so the
      // Reader page hits notFound() — the imported content never renders.
      await expect(otherPage.getByText("quick brown fox")).toHaveCount(0);
      await expect(otherPage.locator("body")).toContainText("404");
    } finally {
      await otherContext.close();
    }
  } finally {
    if (textId) await service.from("texts").delete().eq("id", textId);
  }
});

test("PDF import: a file that is not a real PDF is rejected client-side and nothing is saved", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const service = serviceClient();

  const email = await signUpFreshAccount(page);
  await completeOnboardingForTest(email);
  const userId = await getUserIdByEmail(service, email);

  await page.goto("/library/new");
  await page.getByRole("tab", { name: "Файл" }).click();
  await page.getByRole("button", { name: "PDF", exact: true }).click();

  // Declared as application/pdf but the bytes are not "%PDF-" — validatePdfFile()
  // checks the real signature, not the browser-declared type.
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "not-really.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("This is plain text pretending to be a PDF document, definitely long enough.", "utf8"),
    });

  await expect(page.locator('p[role="alert"]')).toContainText(/не настоящий PDF|повреждён/i, { timeout: 15_000 });
  await expect(page.locator("#pdf-import-body")).toHaveCount(0);

  const { count } = await service
    .from("texts")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);
  expect(count ?? 0, "no texts row created from the rejected file").toBe(0);
});
