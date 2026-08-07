"use client";

import { useState, useTransition } from "react";
import { getMissionHistoryAction } from "../actions";
import MissionCard from "@/components/product/missions/mission-card";
import type { MissionRow } from "@/lib/missions/types";

// Simple "load more" pagination (plan doc §"Mission History: paginated,
// secondary") — getMissionHistoryAction takes a plain limit, no cursor, so
// re-fetching with a bigger limit each time is the honest minimal
// implementation rather than building cursor pagination for a secondary
// screen.
export default function HistoryList({ initialMissions, pageSize }: { initialMissions: MissionRow[]; pageSize: number }) {
  const [missions, setMissions] = useState(initialMissions);
  const [hasMore, setHasMore] = useState(initialMissions.length >= pageSize);
  const [isPending, startTransition] = useTransition();

  function loadMore() {
    const nextLimit = missions.length + pageSize;
    startTransition(async () => {
      const next = await getMissionHistoryAction(nextLimit);
      setMissions(next);
      setHasMore(next.length === nextLimit);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {missions.map((m) => (
        <MissionCard key={m.id} mission={m} />
      ))}
      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isPending}
          className="focus-ring self-center rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {isPending ? "…" : "Показать ещё"}
        </button>
      )}
    </div>
  );
}
