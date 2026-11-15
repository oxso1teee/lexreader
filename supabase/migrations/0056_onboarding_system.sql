-- docs/moments/ROADMAP.md, этап 7 — первый запуск и система.
--
-- streak_goal_days: обязательство из Streak-commit (7/14/30/50 дней),
-- выбирается один раз в онбординге. Веса STREAK_MILESTONES в
-- streak-engine.ts не меняются — эта колонка только определяет, какая
-- веха подсвечивается на /streak как "твоя цель" раньше остальных.
--
-- last_rate_prompt_at: сторож Rate-app — не чаще раза в 120 дней,
-- показывается только в нативной сборке.
--
-- texts.is_starter: системный текст (owner_id null), который First-text
-- открывает новому пользователю. RLS "texts: read own or system"
-- (0001_init.sql) уже разрешает select для owner_id is null — новая
-- политика не нужна, /read/[textId]/page.tsx тоже уже не фильтрует по
-- owner_id при чтении самого текста.
alter table profiles add column streak_goal_days smallint;
alter table profiles add column last_rate_prompt_at timestamptz;

alter table texts add column is_starter boolean not null default false;
create unique index texts_one_starter_per_language on texts (language) where is_starter;

-- Оригинальный короткий текст (не копирайт), B1, ровно один на язык —
-- READY_LANGUAGES сейчас только 'en' (src/lib/languages.ts), этого
-- достаточно для First-text.
insert into texts (owner_id, title, body, source_type, language, level_tag, word_count, is_starter)
values (
  null,
  'The Lighthouse Keeper''s Apprentice',
  $body$Mara had lived on the island for three years, and in all that time the lighthouse had never once gone dark. Every evening, when the sun dropped behind the grey water, she climbed the hundred and twelve steps to the lamp room and lit the great lantern. Every morning she climbed back down, tired but satisfied, to sleep through the brightest hours of the day.

Her grandfather had kept the light before her. He used to say that a lighthouse keeper's job was simple: never let the fire go out. "Ships don't care about your excuses," he told her once. "They only care about the light."

This morning, however, something was different. A small boat was tied to the dock below, rocking gently against the old wooden posts. Mara had not heard anyone arrive. She walked down to the water, her boots crunching on the pebbled path, and found a boy sitting on the rocks, watching the waves.

"You're not supposed to be here," she said, though not unkindly.

The boy looked up. He was perhaps twelve years old, with salt-stiffened hair and a jacket two sizes too big for him. "My boat broke," he said simply. "I was trying to reach the mainland, and the engine stopped working."

Mara sighed. The nearest village was hours away by sea, and the weather was turning. She looked at the darkening clouds on the horizon and made a decision she would think about for years afterward.

"You'll stay until the storm passes," she told him. "But you'll help me with the light tonight. A lighthouse doesn't run itself."

The boy's eyes widened, somewhere between fear and excitement. He had never climbed a lighthouse before, let alone lit one. But he nodded, because the alternative was sitting alone on a cold rock while a storm approached, and that seemed like a worse idea entirely.

Together they climbed the hundred and twelve steps, Mara explaining the mechanism of the great lamp as they went: how the oil fed the flame, how the glass lenses bent the light into a single powerful beam, how sailors far out at sea depended on that beam to know exactly where the rocks were hiding beneath the water.

"If we get it wrong," she said, lighting the final match, "someone out there doesn't come home."

The boy understood, finally, why she climbed those stairs every single evening without fail.$body$,
  'system',
  'en',
  'B1',
  400,
  true
);
