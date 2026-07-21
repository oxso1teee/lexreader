import { createClient } from "@/lib/supabase/server";

const HEADER = [
  "headword",
  "translation",
  "context_sentence",
  "context_translation",
  "status",
  "source_text",
  "created_at",
];

function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: items } = await supabase
    .from("vocabulary_items")
    .select(
      "headword, translation, context_sentence, context_translation, status, created_at, texts(title)",
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  const rows = (items ?? []).map((item) => {
    const sourceTitle = (item.texts as unknown as { title: string } | null)?.title ?? "";
    return [
      item.headword,
      item.translation,
      item.context_sentence ?? "",
      item.context_translation ?? "",
      item.status,
      sourceTitle,
      item.created_at,
    ]
      .map(csvField)
      .join(",");
  });

  // BOM, чтобы Excel корректно открывал кириллицу в UTF-8.
  const csv = "﻿" + [HEADER.join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lexreader-vocabulary.csv"',
    },
  });
}
