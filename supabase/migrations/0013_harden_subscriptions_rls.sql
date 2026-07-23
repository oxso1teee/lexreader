-- P0-АУДИТ 2.1: политика "subscriptions: owner full access" разрешала
-- любому авторизованному пользователю писать/обновлять/удалять СВОЮ
-- строку в subscriptions напрямую через Supabase API — то есть выдать
-- себе Premium в обход и Stripe, и кнопки "Начать" вообще. Единственный
-- источник истины о статусе подписки — вебхук Stripe и (в деве)
-- simulateSubscribe, оба теперь работают через service_role (см.
-- src/app/(app)/pricing/actions.ts). Обычным пользователям оставляем
-- только чтение своей строки.

drop policy if exists "subscriptions: owner full access" on subscriptions;

create policy "subscriptions: owner read only" on subscriptions
  for select using (owner_id = auth.uid());

revoke insert, update, delete on subscriptions from authenticated;
