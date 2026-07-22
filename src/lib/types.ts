export interface Profile {
  id: string;
  target_language: string;
  native_language: string;
  level: string | null;
  daily_word_goal: number;
  streak_current: number;
  streak_longest: number;
  last_active_date: string | null;
  created_at: string;
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
  created_at: string;
}

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
