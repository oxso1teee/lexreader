-- Раздел 5 промта 2026-07-30 (запуск): язык без готового контента в
-- онбординге теперь не выбирается напрямую — вместо этого лист ожидания,
-- чтобы не подсовывать пустую библиотеку и не терять интерес пользователя.
create table language_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  language text not null,
  created_at timestamptz not null default now(),
  unique (email, language)
);

alter table language_waitlist enable row level security;

create policy "language_waitlist: anyone can insert" on language_waitlist
  for insert with check (true);

grant insert on language_waitlist to authenticated, anon;
