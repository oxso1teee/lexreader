"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteWord, markKnown, setPhotoUrl } from "./actions";

export default function WordRow({
  id,
  ownerId,
  headword,
  translation,
  sourceTitle,
  status,
  photoUrl,
}: {
  id: string;
  ownerId: string;
  headword: string;
  translation: string;
  sourceTitle: string | null;
  status: string;
  photoUrl: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  async function handlePhotoChange(file: File) {
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${ownerId}/${id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("word-photos")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("word-photos").getPublicUrl(path);
      await setPhotoUrl(id, publicUrl);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-4 py-3 dark:border-white/15">
      <div className="flex min-w-0 items-center gap-3">
        <label className="relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-black/15 text-black/30 hover:border-black/30 dark:border-white/20 dark:text-white/30 dark:hover:border-white/40">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : uploading ? (
            <span className="text-xs">…</span>
          ) : (
            <span className="text-lg">📷</span>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePhotoChange(file);
            }}
          />
        </label>
        <div className="min-w-0">
          <p className="font-medium">{headword}</p>
          <p className="truncate text-sm text-black/50 dark:text-white/50">
            {translation}
            {sourceTitle ? ` · ${sourceTitle}` : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {status !== "known" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => markKnown(id))}
            className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium hover:border-black/30 disabled:opacity-40 dark:border-white/15 dark:hover:border-white/40"
          >
            Уже знаю
          </button>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => deleteWord(id))}
          className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium text-red-600 hover:border-red-300 disabled:opacity-40 dark:border-white/15 dark:text-red-400 dark:hover:border-red-800"
        >
          Удалить
        </button>
      </div>
    </div>
  );
}
