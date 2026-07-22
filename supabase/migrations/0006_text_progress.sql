-- Прогресс чтения на уровне текста: % прочитано, последняя открытая страница,
-- дата последнего чтения. Отдельная таблица, т.к. это per-user состояние,
-- а texts может быть системным (общим для всех пользователей).

create table text_progress (
  owner_id uuid not null references profiles(id) on delete cascade,
  text_id uuid not null references texts(id) on delete cascade,
  last_page_index int not null default 0,
  percent_read int not null default 0 check (percent_read between 0 and 100),
  last_read_at timestamptz,
  primary key (owner_id, text_id)
);

alter table text_progress enable row level security;

create policy "text_progress: owner full access" on text_progress
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on text_progress to authenticated;
