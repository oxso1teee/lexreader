# LexReader

Приложение для изучения языка через чтение реальных текстов: читаешь → тапаешь непонятное слово → получаешь перевод в контексте → сохраняешь в свой словарь → повторяешь по SRS (SM-2).

Полное ТЗ: [lexpring-clone-spec.md](./lexpring-clone-spec.md).

## Стек

- **Frontend**: Next.js (App Router) + React + Tailwind CSS
- **Backend/БД/Auth**: Supabase (Postgres + Auth + Storage), Row Level Security по `owner_id = auth.uid()`
- **Перевод**: MyMemory API (бесплатно, без ключа) через `src/lib/translate.ts` — абстракция, легко заменить на LibreTranslate (self-hosted) или DeepL позже
- **SRS**: SM-2, реализация в `src/lib/srs.ts`

## Разработка

```bash
npm run dev
```

Открыть [http://localhost:3000](http://localhost:3000).

### Supabase

1. Создать проект на [supabase.com](https://supabase.com) (или поднять локально через `npx supabase start`).
2. Скопировать `.env.local.example` в `.env.local` и заполнить ключи.
3. Применить миграцию из `supabase/migrations/` через Supabase Studio (SQL Editor) или `npx supabase db push`.

## Порядок реализации (см. раздел 13 ТЗ)

1. Схема БД + RLS
2. Онбординг → `profiles`
3. Читалка с tap-to-translate (критический путь)
4. Словарь (notebook) + сохранение слов
5. SRS-очередь и сессия повторения
6. Экран прогресса
7. Paywall и подписки (в последнюю очередь)
