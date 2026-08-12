-- M3 Slice 8 — extends language_error_patterns' category check constraint
-- with exactly 5 new values needed to close the Learning Paths taxonomy gap
-- found during the audit (plan doc §4/§9): comparative, modal,
-- relative_clause, conditional, question_formation. Every one is backed by
-- real grammar-bank.ts Mission coverage (see GRAMMAR_RUNNER_CATEGORIES).
--
-- Purely additive to the constraint's allowed value set — no existing row
-- is touched, no existing value removed, no other column/table affected.
-- `category` is plain `text` with an inline check (not a Postgres enum
-- type), so this is a safe constraint swap, not `ALTER TYPE ADD VALUE`.

alter table language_error_patterns drop constraint if exists language_error_patterns_category_check;
alter table language_error_patterns add constraint language_error_patterns_category_check
  check (category in (
    'activation', 'review_recall', 'article', 'preposition', 'word_order', 'tense', 'passive',
    'gerund_infinitive', 'possession', 'collocation', 'spelling', 'other',
    'comparative', 'modal', 'relative_clause', 'conditional', 'question_formation'
  ));

-- Rollback (not executed — safe only if no row uses a new category value
-- yet; verify with `select distinct category from language_error_patterns
-- where category in ('comparative','modal','relative_clause','conditional','question_formation');`
-- returning zero rows before running this):
--
-- alter table language_error_patterns drop constraint if exists language_error_patterns_category_check;
-- alter table language_error_patterns add constraint language_error_patterns_category_check
--   check (category in (
--     'activation', 'review_recall', 'article', 'preposition', 'word_order', 'tense', 'passive',
--     'gerund_infinitive', 'possession', 'collocation', 'spelling', 'other'
--   ));
