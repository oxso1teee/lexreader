"use client";

import { log } from "@/lib/log";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  log.error({ kind: "unhandled", message: error.message, digest: error.digest });

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <p className="text-4xl">😕</p>
      <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        Произошла непредвиденная ошибка. Попробуй ещё раз — обычно это временный сбой.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex min-h-11 items-center justify-center rounded-full bg-caramel px-5 font-medium text-white"
        >
          Попробовать снова
        </button>
        <a
          href="/home"
          className="flex min-h-11 items-center justify-center rounded-full border border-black/15 px-5 font-medium dark:border-white/20"
        >
          На главную
        </a>
      </div>
    </div>
  );
}
