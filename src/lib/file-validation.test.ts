import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateImageFile,
  validatePdfFile,
  MAX_IMAGE_SIZE_BYTES,
  MAX_PDF_SIZE_BYTES,
} from "./file-validation.ts";

// Real minimal-but-valid signatures for each allowed format — enough bytes
// for every check in file-validation.ts to have real magic bytes to read,
// padded with filler so size checks below have something realistic to work
// against.
const REAL_JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];
const REAL_PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d];
const REAL_GIF_HEADER = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00];
// "RIFF" + 4-byte size (arbitrary) + "WEBP"
const REAL_WEBP_HEADER = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
const REAL_PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]; // "%PDF-1.4"

function makeFile(bytes: number[], name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

// --- The exact scenario this fix closes: right extension, right declared
// Content-Type, wrong actual content. ---

test("validateImageFile rejects a .jpg file with a correct Content-Type but arbitrary binary content", async () => {
  const notActuallyAJpeg = makeFile(
    [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00], // starts like a Windows PE/EXE, not a JPEG
    "photo.jpg",
    "image/jpeg",
  );
  const error = await validateImageFile(notActuallyAJpeg);
  assert.ok(error, "a file whose bytes don't match any real image signature must be rejected");
  assert.match(error!, /не настоящее изображение/);
});

test("validatePdfFile rejects a .pdf file with a correct Content-Type but arbitrary binary content", async () => {
  const notActuallyAPdf = makeFile(
    [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00], // starts like a ZIP, not "%PDF-"
    "document.pdf",
    "application/pdf",
  );
  const error = await validatePdfFile(notActuallyAPdf);
  assert.ok(error, "a file whose bytes don't start with %PDF- must be rejected, even with the right extension/Content-Type");
  assert.match(error!, /не настоящий PDF/);
});

// --- Real files of every allowed format must still pass. ---

test("validateImageFile accepts a real JPEG", async () => {
  const error = await validateImageFile(makeFile(REAL_JPEG_HEADER, "photo.jpg", "image/jpeg"));
  assert.equal(error, null);
});

test("validateImageFile accepts a real PNG", async () => {
  const error = await validateImageFile(makeFile(REAL_PNG_HEADER, "photo.png", "image/png"));
  assert.equal(error, null);
});

test("validateImageFile accepts a real GIF", async () => {
  const error = await validateImageFile(makeFile(REAL_GIF_HEADER, "photo.gif", "image/gif"));
  assert.equal(error, null);
});

test("validateImageFile accepts a real WebP", async () => {
  const error = await validateImageFile(makeFile(REAL_WEBP_HEADER, "photo.webp", "image/webp"));
  assert.equal(error, null);
});

test("validatePdfFile accepts a real PDF", async () => {
  const error = await validatePdfFile(makeFile(REAL_PDF_HEADER, "doc.pdf", "application/pdf"));
  assert.equal(error, null);
});

// --- Format confusion: real bytes of one allowed format, mislabeled as
// another allowed format's extension/Content-Type. Still must be accepted —
// validateImageFile only promises "this is a real image of an allowed
// type", not "this specific extension matches this specific format". The
// signature check itself, not the filename, decides which format it is. ---

test("validateImageFile accepts a real PNG even when named/declared as a .jpg", async () => {
  const error = await validateImageFile(makeFile(REAL_PNG_HEADER, "photo.jpg", "image/jpeg"));
  assert.equal(error, null);
});

// --- Existing checks (declared type prefix, size cap) still apply. ---

test("validateImageFile still rejects a non-image declared Content-Type outright", async () => {
  const error = await validateImageFile(makeFile(REAL_JPEG_HEADER, "photo.jpg", "application/octet-stream"));
  assert.match(error ?? "", /Выбери файл изображения/);
});

test("validatePdfFile still rejects a non-PDF declared Content-Type outright", async () => {
  const error = await validatePdfFile(makeFile(REAL_PDF_HEADER, "doc.pdf", "text/plain"));
  assert.match(error ?? "", /Выбери файл в формате PDF/);
});

test("validateImageFile still enforces the size cap on an otherwise-real image", async () => {
  const oversized = new File([new Uint8Array(MAX_IMAGE_SIZE_BYTES + 1)], "big.png", { type: "image/png" });
  // Overwrite the first bytes with a real PNG signature so only the size
  // check is under test here, not the signature check.
  const header = new Uint8Array(await oversized.slice(0, REAL_PNG_HEADER.length).arrayBuffer());
  header.set(REAL_PNG_HEADER);
  const withRealSignature = new File(
    [header, oversized.slice(REAL_PNG_HEADER.length)],
    "big.png",
    { type: "image/png" },
  );
  assert.equal(withRealSignature.size, MAX_IMAGE_SIZE_BYTES + 1);
  const error = await validateImageFile(withRealSignature);
  assert.match(error ?? "", /максимум 5 МБ/);
});

test("validatePdfFile still enforces the size cap on an otherwise-real PDF", async () => {
  const filler = new Uint8Array(MAX_PDF_SIZE_BYTES + 1 - REAL_PDF_HEADER.length);
  const oversized = new File(
    [new Uint8Array(REAL_PDF_HEADER), filler],
    "big.pdf",
    { type: "application/pdf" },
  );
  assert.equal(oversized.size, MAX_PDF_SIZE_BYTES + 1);
  const error = await validatePdfFile(oversized);
  assert.match(error ?? "", /максимум 20 МБ/);
});
