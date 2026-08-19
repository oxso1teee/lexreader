import PageHeader from "@/components/product/page-header";
import GrammarGymClient from "./grammar-gym-client";

export default function GrammarGymPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <PageHeader title="Grammar Gym" />
      <GrammarGymClient />
    </div>
  );
}
