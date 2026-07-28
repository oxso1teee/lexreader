-- Идея из разбора конкурента (docs/GROWTH_IDEAS_2026-07-24.md, п.1):
-- многостраничные книги/серии текстов лучше группировать вручную под одним
-- названием, чем пытаться автоматически склеивать все страницы сайта —
-- второй подход упирается в антибот/JS-рендеринг сайтов (см. миграцию про
-- rel="next" в library/actions.ts, которая работает не для всех сайтов).

create table collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  language text not null,
  created_at timestamptz not null default now()
);

alter table texts add column collection_id uuid references collections(id) on delete set null;
-- Порядок глав внутри коллекции — проставляется приложением при импорте
-- (текущее количество текстов в коллекции + 1), не полагаемся на created_at,
-- чтобы порядок не съезжал при разных источниках импорта с разной задержкой.
alter table texts add column collection_order int;

create index collections_owner_language_idx on collections (owner_id, language);
create index texts_collection_idx on texts (collection_id);

alter table collections enable row level security;

create policy "collections: owner full access" on collections
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on collections to authenticated;
