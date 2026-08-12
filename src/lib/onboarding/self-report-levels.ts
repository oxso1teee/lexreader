import type { SelfReportedCefr } from "@/lib/placement/types";

// M3 Slice 9 — self-reported CEFR options for the onboarding wizard (plan
// doc §5). Separate from the legacy profiles.level (beginner/intermediate/
// advanced) — that field stays untouched, this drives the new
// self_reported_cefr column instead.
export const SELF_REPORT_LEVELS: { value: SelfReportedCefr; label: string }[] = [
  { value: "A1", label: "A1" },
  { value: "A2", label: "A2" },
  { value: "B1", label: "B1" },
  { value: "B2", label: "B2" },
  { value: "unsure", label: "Не знаю" },
];
