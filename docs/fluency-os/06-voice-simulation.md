# Фаза 6 — Первый голосовой агент (один сценарий, LiveKit Cloud)

**Ворота:** Фаза 5 работает, у ручного Bootcamp достаточно объёма,
чтобы автоматизация окупала время разработки (ориентир: минимум 10
активных пользователей проходят миссии в неделю).
**Источник:** v1 §3.5, §4.2–4.4 (LiveKit), §11 (voice session
lifecycle), v3 §85 (Voice simulation UX).

## Единственное место во всём плане, где действительно нужен
## отдельный сервис

Всё остальное в Фазах 1–5, 7–8 живёт в текущем Next.js-монолите на
Vercel. Голосовой агент — исключение: LiveKit Agents — это
долгоживущий Python-процесс, слушающий комнаты, а не serverless
функция с ограничением по времени выполнения. Не пытаться впихнуть
его в Vercel API route. Это единственный оправданный «отдельный
сервис» из всего, что описывают v1/v2 — не создавать по этому же
поводу ещё api/ai-worker/admin как отдельные сервисы, они не нужны.

## 6.1 Инфраструктура

- **LiveKit Cloud** (не self-hosted `livekit/livekit`) — регистрация
  на livekit.io, бесплатный тариф достаточен для теста.
- **Voice-agent сервис** — новый каталог `voice-agent/` в корне
  репозитория (не внутри `src/`, отдельный `requirements.txt`),
  деплоится отдельно от Vercel — на Fly.io или Railway (у обоих есть
  бесплатный/дешёвый тариф для одного долгоживущего процесса).
  Пакет: `livekit-agents`, провайдер STT/LLM/TTS — использовать
  готовые плагины LiveKit (Deepgram/OpenAI/ElevenLabs или их
  бесплатные аналоги на старте, ключи — в `voice-agent/.env`, не в
  основном Next.js-проекте).

## 6.2 Схема данных — `supabase/migrations/0035_voice_sessions.sql`

```sql
create table voice_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  mission_step_id uuid references mission_steps(id) on delete set null,
  agent_type text not null default 'project_pitch_interviewer',
  room_name text not null unique,
  status text not null default 'created', -- created | active | completed | failed
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  created_at timestamptz not null default now()
);

create table transcript_turns (
  id uuid primary key default gen_random_uuid(),
  voice_session_id uuid not null references voice_sessions(id) on delete cascade,
  position int not null,
  speaker text not null, -- 'user' | 'agent'
  text text not null,
  start_ms int,
  end_ms int
);

-- Простой месячный лимит минут — полноценный usage ledger (Фаза 9)
-- пока не нужен, но грубый предохранитель от неконтролируемых
-- расходов на STT/LLM/TTS нужен уже на MVP.
alter table profiles add column voice_seconds_used_this_month int not null default 0;
alter table profiles add column voice_quota_reset_at timestamptz not null default (date_trunc('month', now()) + interval '1 month');

alter table voice_sessions enable row level security;
alter table transcript_turns enable row level security;
create policy "voice_sessions: owner full access" on voice_sessions for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "transcript_turns: owner via session" on transcript_turns for all
  using (exists (select 1 from voice_sessions v where v.id = voice_session_id and v.owner_id = auth.uid()));
```

Лимит минут: бесплатный план — например, 5 минут голоса всего (не в
месяц — на этапе MVP это тестовый функционал, не полноценный тариф,
полноценные тарифы с голосом — Фаза 11). Проверка лимита — до выдачи
LiveKit-токена, не после.

## 6.3 Единственный агент — `voice-agent/agents/project_pitch_interviewer.py`

Роль: senior backend developer, проводящий mock-интервью о проекте
пользователя. System prompt строится из: цели миссии, `target_phrases`
текущего `mission_step`, уровня пользователя (`profiles.level`).
Использовать реальные вопросы, зафиксированные в Bootcamp (Фаза 4) —
не придумывать заново. Никаких дополнительных ролей (Client, PM,
Standup, Examiner из v1 §3.5) в этой фазе — это Фаза 8+, только
после того как один сценарий доказал ценность.

Правила поведения агента (из v3 §85, `Pre-session`/`During`/`Post-session`):
- не исправлять пользователя построчно во время разговора;
- задавать один уточняющий вопрос за раз, не забрасывать списком;
- явно завершать сессию по таймеру (жёсткий лимит 5 минут на MVP —
  без этого нет предсказуемости по стоимости).

## 6.4 API-маршрут — `src/app/api/voice/sessions/route.ts`

`POST` — принимает `missionStepId`, проверяет `voice_seconds_used_this_month`
против квоты, создаёт `voice_sessions` строку, создаёт LiveKit room +
access token (`livekit-server-sdk`), возвращает токен клиенту.
Триггерит запуск агента — либо LiveKit dispatch rule (агент сам
подключается к новым комнатам с нужным именем/метаданными), либо
явный вызов `voice-agent` сервиса по webhook — выбрать dispatch rule,
он проще и не требует, чтобы Next.js знал адрес voice-agent сервиса.

## 6.5 UI — `/app/practice/speaking` или встроенный шаг сессии

Использовать мокап «Экран 05» из
`docs/FLUENCY_OS_VISION_ALL3_2026-07-31.html` как основу: pre-session
карточка (роль, цель, целевые фразы, уведомление о записи, кнопка
старта) → during (waveform, таймер, живой транскрипт опционально) →
после завершения редирект на разбор (Фаза 7 — до неё просто
показывать сырой транскрипт).

Клиентская библиотека: `livekit-client` + React SDK `@livekit/components-react`.

## 6.6 Что НЕ делать в этой фазе

- Не подключать WhisperX для постобработки — LiveKit-плагины уже
  дают транскрипт в реальном времени, WhisperX (офлайн, точный
  alignment) актуален только для загруженных аудио/видео файлов
  (Фаза 8), не для live-звонков.
- Не строить self-hosted LiveKit — переход на `livekit/livekit`
  имеет смысл только при реальном масштабе (v1 §4.3 сам это
  признаёт), не на первом агенте.
- Не запускать несколько сценариев параллельно ради «богатого MVP» —
  один агент, доведённый до стабильной работы, ценнее пяти сырых.

## Критерий готовности фазы

- Голосовая сессия запускается из шага миссии, соединение
  устанавливается меньше чем за 2 секунды (целевая метрика v1 §11).
- Агент придерживается роли и завершает сессию по таймеру.
- `transcript_turns` сохраняются полностью и в правильном порядке.
- Лимит минут реально блокирует создание новой сессии после
  исчерпания квоты, с понятным сообщением пользователю.
- Полный сценарий проверен вживую минимум 10 раз с разными
  формулировками ответов, не только один раз «для галочки».
