"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteWord, markKnown, setPhotoUrl, toggleFavorite } from "./actions";
import { validateImageFile } from "@/lib/file-validation";

export default function WordRow({
  id,
  ownerId,
  headword,
  translation,
  sourceTitle,
  status,
  photoUrl,
  isFavorite,
}: {
  id: string;
  ownerId: string;
  headword: string;
  translation: string;
  sourceTitle: string | null;
  status: string;
  photoUrl: string | null;
  isFavorite: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Мгновенный отклик на тап по звёздочке — не ждём revalidatePath, чтобы
  // список слов не мигал при переключении одного флага.
  const [favoriteOverride, setFavoriteOverride] = useState<boolean | null>(null);
  const favorite = favoriteOverride ?? isFavorite;
  // Найдено при повторном аудите: бакет word-photos был публично читаемым —
  // теперь приватный, показываем фото через подписанный URL (короткий срок
  // жизни), а не постоянный публичный. Локальный override для мгновенного
  // отображения сразу после загрузки, пока страница не перезапросит данные.
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null);

  async function handlePhotoChange(file: File) {
    const validationError = validateImageFile(file);
    if (validationError) {
      setPhotoError(validationError);
      return;
    }
    setPhotoError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${ownerId}/${id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("word-photos")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: signed } = await supabase.storage
        .from("word-photos")
        .createSignedUrl(path, 3600);
      if (signed?.signedUrl) setLocalPhotoUrl(signed.signedUrl);

      // В базе храним путь, а не URL — подписанные URL истекают, путь нет.
      await setPhotoUrl(id, path);
    } catch {
      // P0-АУДИТ 3.17: раньше сбой загрузки был полностью тихим — спиннер
      // просто пропадал, без единого сообщения пользователю.
      setPhotoError("Не удалось загрузить фото. Попробуй ещё раз.");
    } finally {
      setUploading(false);
    }
  }

  function handleToggleFavorite() {
    const next = !favorite;
    setFavoriteOverride(next);
    startTransition(() => toggleFavorite(id, next));
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-4 py-3 dark:border-white/15">
      <div className="flex min-w-0 items-center gap-3">
        <label
          aria-label="Добавить фото к слову"
          className="relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-black/15 text-black/30 hover:border-black/30 dark:border-white/20 dark:text-white/30 dark:hover:border-white/40"
        >
          {localPhotoUrl || photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={localPhotoUrl ?? photoUrl!} alt="" className="h-full w-full object-cover" />
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
          <p className="flex items-center gap-1.5 font-medium">
            <button
              type="button"
              onClick={handleToggleFavorite}
              aria-label={favorite ? "Убрать из избранного" : "Добавить в избранное"}
              className={`shrink-0 ${favorite ? "text-yellow-500" : "text-black/20 hover:text-black/40 dark:text-white/20 dark:hover:text-white/40"}`}
            >
              {favorite ? "★" : "☆"}
            </button>
            <span className="truncate">{headword}</span>
          </p>
          <p className="truncate text-sm text-black/50 dark:text-white/50">
            {translation}
            {sourceTitle ? ` · ${sourceTitle}` : ""}
          </p>
          {photoError && <p className="text-xs text-red-600 dark:text-red-400">{photoError}</p>}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {status !== "known" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => markKnown(id))}
            className="flex min-h-11 items-center justify-center rounded-full border border-black/10 px-3 text-xs font-medium hover:border-black/30 disabled:opacity-40 dark:border-white/15 dark:hover:border-white/40"
          >
            Уже знаю
          </button>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => deleteWord(id))}
          className="flex min-h-11 items-center justify-center rounded-full border border-black/10 px-3 text-xs font-medium text-red-600 hover:border-red-300 disabled:opacity-40 dark:border-white/15 dark:text-red-400 dark:hover:border-red-800"
        >
          Удалить
        </button>
      </div>
    </div>
  );
}
