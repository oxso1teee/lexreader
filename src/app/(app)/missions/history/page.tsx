import { requireProfile } from "@/lib/auth";
import { getMissionHistoryAction } from "../actions";
import EmptyState from "@/components/empty-state";
import MissionsSubHeader from "../sub-header";
import HistoryList from "./history-list";

const PAGE_SIZE = 20;

export default async function MissionHistoryPage() {
  await requireProfile();
  const missions = await getMissionHistoryAction(PAGE_SIZE);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <MissionsSubHeader
        title="История миссий"
        description="Завершённые, отклонённые и истёкшие миссии за последнее время."
      />
      {missions.length === 0 ? (
        <EmptyState
          icon="🗂️"
          title="История пуста"
          body="Здесь появятся миссии, которые ты завершишь, отклонишь или которые истекут."
        />
      ) : (
        <HistoryList initialMissions={missions} pageSize={PAGE_SIZE} />
      )}
    </div>
  );
}
