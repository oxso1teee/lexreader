# Фаза 5 — Goal Engine + Mission Engine + Today

**Ворота:** Фаза 4 пройдена — минимум 60% завершаемость Bootcamp,
минимум 20% готовы платить (см. `04-bootcamp-manual-validation.md`).
**Источник:** v1 §3.2–3.3, §3.9 (Daily Session), v3 §80 (Mission
page), §79 (Today page — переопределяет структуру `TodayCard`).

## Цель

Превратить ручной 7-дневный Bootcamp из Фазы 4 в автоматизированную,
но всё ещё голосом-независимую программу: пользователь выбирает
цель, получает миссию с этапами, каждый этап — текстовые/карточные
задания (голос подключается только в Фазе 6). Использовать реальные
данные из Bootcamp (какие вопросы реально задавались, какие ошибки
реально повторялись) как содержимое шаблона миссии «Питч проекта» —
не выдумывать заново.

## 5.1 Схема данных — `supabase/migrations/0034_missions.sql`

```sql
create table goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  type text not null, -- 'interview' | 'project_pitch' | 'standup' | 'client_call' | 'general'
  title text not null,
  target_date date,
  status text not null default 'active', -- 'active' | 'completed' | 'abandoned'
  created_at timestamptz not null default now()
);

create table mission_templates (
  id uuid primary key default gen_random_uuid(),
  goal_type text not null,
  title text not null,
  description text not null,
  duration_days int not null,
  is_active boolean not null default true
);

create table missions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  template_id uuid references mission_templates(id),
  title text not null,
  duration_days int not null,
  status text not null default 'in_progress', -- 'in_progress' | 'completed' | 'abandoned'
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table mission_steps (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions(id) on delete cascade,
  position int not null,
  title text not null,
  instructions text not null,
  target_phrases text[] not null default '{}',
  status text not null default 'locked', -- 'locked' | 'available' | 'in_progress' | 'completed' | 'needs_retry'
  estimated_minutes int not null,
  unique (mission_id, position)
);

alter table goals enable row level security;
alter table missions enable row level security;
alter table mission_steps enable row level security;
create policy "goals: owner full access" on goals for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "missions: owner full access" on missions for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "mission_steps: owner via mission" on mission_steps for all
  using (exists (select 1 from missions m where m.id = mission_id and m.owner_id = auth.uid()));
```

`mission_templates` — не для конечного пользователя, заполняется
вручную SQL-сидом (`supabase/seed.sql`), не через UI. Первый шаблон —
«7-Day Project Pitch», семь строк `mission_steps`-заготовок
(instructions), взятых буквально из дневных сценариев Bootcamp
(Фаза 4, раздел «Как проходит один день»), не придуманных заново.

## 5.2 Onboarding — теперь добавляется шаг цели

В Фазе 1 явно было сказано не добавлять goal picker раньше времени —
теперь время пришло. `src/app/onboarding/onboarding-wizard.tsx`:
новый шаг после выбора языка — 4 карточки (цели из Bootcamp:
интервью / питч проекта / дейли-созвоны / просто увереннее
общаться), см. мокап «Экран 01» в
`docs/FLUENCY_OS_VISION_ALL3_2026-07-31.html`. Записывает
`goals` строку через тот же server action, что создаёт профиль.

## 5.3 Today — `src/app/(app)/home/today-card.tsx`

Не переписывать с нуля — расширить существующую карточку: если у
пользователя есть `missions.status = 'in_progress'`, показывать
текущий этап миссии вместо (или вместе с) текущей структуры
слов/повторов/чтения, по правилу v3 «один следующий шаг» (см.
Фазу 1, раздел 1.3 — правило уже применено structurally, теперь
просто меняется источник данных на активную миссию, когда она есть).
Если миссии нет — текущее поведение `TodayCard` остаётся как есть,
это не ломающее изменение, а дополнительная ветка рендера.

## 5.4 Экран миссии — новый `/missions/[missionId]`

`src/app/(app)/missions/[missionId]/page.tsx` — список
`mission_steps` со статус-чипами (см. мокап «Экран 03» в артефакте
выше), текущий этап открыт, кнопка «Продолжить день N».

## Критерий готовности фазы

- Миграция применена, первый шаблон «7-Day Project Pitch» засеян
  реальными данными Bootcamp.
- Онбординг спрашивает цель, `goals` создаётся.
- При создании первой миссии (действие «Начать миссию» на `/missions`)
  генерируются 7 `mission_steps` из шаблона.
- Today показывает текущий этап активной миссии.
- `/missions/[id]` отображает все этапы с корректными статусами.
- Полный сценарий проверен вручную: выбрать цель → начать миссию →
  пройти этап → увидеть его completed → следующий стал available.
