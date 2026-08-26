export interface Profile {
  id: string;
  target_language: string;
  native_language: string;
  level: string | null;
  daily_word_goal: number;
  streak_current: number;
  streak_longest: number;
  last_active_date: string | null;
  streak_freeze_available: boolean;
  streak_freeze_week: string | null;
  review_best_session_count: number;
  completed_first_win: boolean;
  preferred_notify_hour: number | null;
  xp: number;
  created_at: string;
  reader_settings: Record<string, unknown>;
  /** M3 Slice 9 — onboarding goal/self-report, both nullable (never
   *  backfilled for pre-Slice-9 rows). See src/lib/onboarding/goals.ts and
   *  src/lib/placement/types.ts for the exact allowed values. */
  primary_goal: string | null;
  self_reported_cefr: string | null;
  /** docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3
   *  — explicit opt-in for the weekly leaderboard, default false. See
   *  supabase/migrations/0049_weekly_leaderboard.sql. */
  leaderboard_opt_in: boolean;
}

export type TextSourceType = "manual" | "article_url" | "youtube" | "system";

export interface TextRow {
  id: string;
  owner_id: string | null;
  title: string;
  body: string;
  source_type: TextSourceType;
  source_url: string | null;
  language: string;
  level_tag: string | null;
  word_count: number | null;
  youtube_video_id: string | null;
  collection_id: string | null;
  collection_order: number | null;
  created_at: string;
  /** M3 Slice 12 — nullable, only set for youtube-sourced texts (migration 0042). */
  youtube_duration_seconds: number | null;
  transcript_source: TranscriptSourceTag | null;
  processing_status: "pending" | "processing" | "ready" | "failed";
}

export type TranscriptSourceTag =
  | "manual_caption"
  | "auto_caption"
  | "innertube"
  | "browser_bridge"
  | "yt_dlp_caption"
  | "speech_to_text";

export interface Collection {
  id: string;
  owner_id: string;
  title: string;
  language: string;
  created_at: string;
}

export type VocabularyStatus = "new" | "learning" | "known" | "ignored";

export interface VocabularyItem {
  id: string;
  owner_id: string;
  source_text_id: string | null;
  headword: string;
  translation: string;
  context_sentence: string | null;
  context_translation: string | null;
  photo_url: string | null;
  status: VocabularyStatus;
  level: number;
  seen_count: number;
  created_at: string;
}

export const WORD_LEVELS = [
  { level: 0, label: "Новое", color: "#ea580c" },
  { level: 1, label: "Видел раньше", color: "#f97316" },
  { level: 2, label: "Знакомое", color: "#fb923c" },
  { level: 3, label: "Знаю значение", color: "#fdba74" },
  { level: 4, label: "Овладел", color: "#a1a1aa" },
] as const;

export interface SrsStateRow {
  flashcard_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  due_at: string;
  last_reviewed_at: string | null;
}

export interface Deck {
  id: string;
  owner_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface Flashcard {
  id: string;
  deck_id: string;
  owner_id: string;
  front: string;
  back: string;
  notes: string | null;
  photo_url: string | null;
  created_at: string;
}

export type StudyDirection = "front_back" | "back_front";

export interface SrsSettings {
  owner_id: string;
  new_cards_per_day: number;
  max_reviews_per_day: number;
  study_direction: StudyDirection;
  starting_ease: number;
  easy_bonus: number;
  interval_modifier: number;
  max_interval_days: number;
  learning_steps_minutes: string;
  relearning_steps_minutes: string;
  graduating_interval_days: number;
  easy_interval_days: number;
  show_timer: boolean;
  autoplay_audio: boolean;
}
