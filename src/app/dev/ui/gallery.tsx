"use client";

import { Bell, Briefcase, Compass, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  ChoiceGroup,
  Dialog,
  Drawer,
  DropdownMenu,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  LoadingState,
  NotFoundState,
  OfflineState,
  Progress,
  ProgressRing,
  RadioGroup,
  Select,
  Skeleton,
  SkeletonText,
  Spinner,
  Switch,
  TabPanel,
  Tabs,
  Textarea,
  Tooltip,
  toast,
} from "@/components/ui";
import { PasswordField } from "@/components/product/auth/password-field";
import { PasswordRequirements } from "@/components/product/auth/password-meter";
import { LEX_MOODS, Lex } from "@/components/product/mascot/lex";
import { useTheme } from "@/lib/ui/use-theme";

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `sec-${title.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-label uppercase tracking-wide text-[var(--text-secondary)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function UiGallery() {
  const { preference, setTheme } = useTheme();
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [period, setPeriod] = useState("week");
  const [lastAction, setLastAction] = useState("—");
  const [email, setEmail] = useState("");
  const [demoPassword, setDemoPassword] = useState("");
  const [demoConfirm, setDemoConfirm] = useState("");
  const [demoGoal, setDemoGoal] = useState("travel");
  const [demoAnswer, setDemoAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <main className="page-content flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">UI kit</h1>
          <p className="text-body-sm text-[var(--text-secondary)]">Phase 1 · токены, компоненты, состояния</p>
        </div>
        <Tabs
          label="Тема"
          value={preference}
          onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}
          items={[
            { value: "light", label: "Светлая" },
            { value: "dark", label: "Тёмная" },
            { value: "system", label: "Системная" },
          ]}
          className="w-full sm:w-72"
        />
      </header>

      <Section title="Кнопки">
        <div className="flex flex-wrap gap-3">
          <Button>Начать занятие</Button>
          <Button variant="sky">Повторить 47</Button>
          <Button variant="ember">Спасти стрик</Button>
          <Button variant="sun">Оформить Plus</Button>
          <Button variant="danger">Удалить</Button>
          <Button variant="ink">Репетитор</Button>
          <Button variant="ghost">Не сейчас</Button>
          <Button size="sm">Маленькая</Button>
          <Button disabled>Недоступна</Button>
          <Button
            loading={saving}
            onClick={() => {
              setSaving(true);
              setTimeout(() => setSaving(false), 1200);
            }}
          >
            {saving ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
        <Button block>На всю ширину</Button>
        <div className="flex flex-wrap items-center gap-2">
          <IconButton label="Уведомления" icon={<Bell className="h-5 w-5" />} />
          <IconButton label="Редактировать" icon={<Pencil className="h-5 w-5" />} variant="boxed" />
          <IconButton label="Добавить" icon={<Plus className="h-5 w-5" />} variant="solid" />
          <IconButton label="Маленькая иконка" icon={<Trash2 className="h-4 w-4" />} size="sm" variant="boxed" />
          <Tooltip content="Удалить колоду">
            <IconButton label="Удалить колоду" icon={<Trash2 className="h-5 w-5" />} variant="boxed" />
          </Tooltip>
        </div>
      </Section>

      <Section title="Карточки">
        <div className="cards-grid">
          <Card>Обычная</Card>
          <Card tone="leaf">leaf — прогресс</Card>
          <Card tone="sky">sky — память</Card>
          <Card tone="sun">sun — награда</Card>
          <Card tone="ember">ember — стрик</Card>
          <Card tone="danger">danger — ошибка</Card>
          <Card tone="sunken">sunken</Card>
          <Card dashed>Добавить</Card>
        </div>
      </Section>

      <Section title="Поля">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} hint="Пришлём ссылку для входа" />
          <Input label="Пароль" type="password" defaultValue="qwerty" error="Неверный email или пароль" />
          <Input label="Недоступное" disabled defaultValue="Только чтение" />
          <Select label="Родной язык" defaultValue="ru">
            <option value="ru">Русский</option>
            <option value="uk">Українська</option>
          </Select>
          <Textarea label="Заметка" placeholder="Что запомнилось?" wrapperClassName="sm:col-span-2" />
        </div>
      </Section>

      <Section title="Поле пароля">
        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordField label="Новый пароль" name="demo-password" autoComplete="new-password" meter onValueChange={setDemoPassword} />
          <PasswordField label="Повтори пароль" name="demo-confirm" autoComplete="new-password" onValueChange={setDemoConfirm} />
          <div className="sm:col-span-2">
            <PasswordRequirements password={demoPassword} confirmation={demoConfirm} />
          </div>
        </div>
      </Section>

      <Section title="Lex">
        <div className="flex flex-wrap items-end gap-4">
          {LEX_MOODS.map((mood) => (
            <figure key={mood} className="flex flex-col items-center gap-1">
              <Lex mood={mood} size={64} />
              <figcaption className="text-caption">{mood}</figcaption>
            </figure>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-4">
          {LEX_MOODS.map((mood) => (
            <Lex key={mood} mood={mood} tone="pale" size={48} />
          ))}
          <Lex tone="ghost" size={56} />
          <Lex mood="wink" size={88} bob />
          <Lex mood="joy" size={120} />
        </div>
      </Section>

      <Section title="Выбор">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Checkbox label="Автоозвучка слова" hint="Произносить при показе карточки" defaultChecked />
            <Checkbox label="Обратные карточки" />
            <Checkbox label="Недоступно" disabled />
          </div>
          <RadioGroup
            legend="Тариф"
            name="plan"
            defaultValue="year"
            options={[
              { value: "year", label: "Год — 299 ₽/мес", hint: "3 588 ₽ сразу" },
              { value: "month", label: "Месяц — 399 ₽" },
            ]}
          />
          <div className="sm:col-span-2">
            <Switch label="Ежедневное напоминание" hint="В 21:00, если ты ещё не занимался" defaultChecked />
            <Switch label="Письма с итогами недели" />
            <Switch label="Недоступный переключатель" disabled />
          </div>
        </div>
      </Section>

      <Section title="Плитки с вариантами">
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceGroup
            legend="Цель занятий"
            name="demo-goal"
            value={demoGoal}
            onValueChange={setDemoGoal}
            options={[
              { value: "travel", label: "Путешествия", description: "Отели, кафе, дорога", icon: <Compass />, tone: "sun" },
              { value: "work", label: "Работа и карьера", description: "Письма, документация, созвоны", icon: <Briefcase />, tone: "sky" },
              { value: "self", label: "Для себя", description: "Без конкретной цели", icon: <Sparkles /> },
            ]}
          />
          <ChoiceGroup
            legend="Какой вариант подходит?"
            name="demo-answer"
            numbered
            value={demoAnswer}
            onValueChange={setDemoAnswer}
            options={[
              { value: "a", label: "lived" },
              { value: "b", label: "am living" },
              { value: "c", label: "have lived" },
              { value: "d", label: "live", disabled: true },
            ]}
          />
          <ChoiceGroup
            legend="Язык для перевода"
            name="demo-language"
            columns={2}
            defaultValue="es"
            className="sm:col-span-2"
            options={[
              { value: "es", label: "Испанский" },
              { value: "de", label: "Немецкий" },
              { value: "fr", label: "Французский" },
              { value: "it", label: "Итальянский", disabled: true },
            ]}
          />
        </div>
      </Section>

      <Section title="Метки и аватары">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Нейтральная</Badge>
          <Badge tone="leaf">Знаю</Badge>
          <Badge tone="sky">Учу</Badge>
          <Badge tone="ember">Горит</Badge>
          <Badge tone="sun">+20 XP</Badge>
          <Badge tone="danger">Ошибка</Badge>
          <Badge tone="solid">Новое</Badge>
          <Badge tone="ink">Скоро</Badge>
          <Badge tone="plus">Plus</Badge>
          <Badge tone="count">3</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Avatar name="Сергей" me />
          <Avatar name="Аня Ким" />
          <Avatar email="test@example.com" size="sm" />
          <Avatar name="Макс" size="lg" />
          <Avatar name="Лена" size="xl" label="Лена" />
        </div>
      </Section>

      <Section title="Вкладки, меню, слои">
        <Tabs
          label="Период"
          value={period}
          onValueChange={setPeriod}
          items={[
            { value: "week", label: "Неделя" },
            { value: "month", label: "Месяц" },
            { value: "all", label: "Всё время" },
          ]}
        >
          <TabPanel value="week" className="pt-3">Данные за неделю</TabPanel>
          <TabPanel value="month" className="pt-3">Данные за месяц</TabPanel>
          <TabPanel value="all" className="pt-3">Данные за всё время</TabPanel>
        </Tabs>
        <Tabs
          label="Раздел"
          variant="underline"
          defaultValue="a"
          items={[
            { value: "a", label: "Слова" },
            { value: "b", label: "Колоды" },
            { value: "c", label: "Скоро", disabled: true },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <DropdownMenu
            label="Действия с колодой"
            items={[
              { label: "Переименовать", icon: <Pencil className="h-4 w-4" />, onSelect: () => setLastAction("rename") },
              { label: "Экспорт CSV", onSelect: () => setLastAction("export") },
              { label: "Недоступно", disabled: true },
              { label: "Удалить", icon: <Trash2 className="h-4 w-4" />, danger: true, onSelect: () => setLastAction("delete") },
            ]}
          />
          <span data-testid="last-action" className="text-body-sm text-[var(--text-secondary)]">
            Последнее действие: {lastAction}
          </span>
          <Button variant="ghost" onClick={() => setDialog(true)}>Открыть диалог</Button>
          <Button variant="ghost" onClick={() => setDrawer(true)}>Открыть панель</Button>
        </div>
        <Dialog
          open={dialog}
          onClose={() => setDialog(false)}
          title="Удалить колоду?"
          description="Карточки и история повторений будут удалены безвозвратно."
          footer={
            <>
              <Button variant="danger" onClick={() => setDialog(false)}>Да, удалить</Button>
              <Button variant="ghost" onClick={() => setDialog(false)}>Оставить</Button>
            </>
          }
        >
          <Input label="Название для подтверждения" placeholder="Путешествия" />
        </Dialog>
        <Drawer open={drawer} onClose={() => setDrawer(false)} title="Фильтры">
          <Checkbox label="Только новые" />
          <Checkbox label="Только трудные" />
        </Drawer>
      </Section>

      <Section title="Прогресс и загрузка">
        <Progress value={0.64} label="Прочитано 64%" />
        <Progress value={0.4} tone="sun" size="lg" label="XP сегодня 40%" />
        <Progress value={0.26} tone="sky" size="sm" label="Повторено 26%" />
        <div className="flex items-center gap-4">
          <ProgressRing value={0.6} label="Цель дня 30 из 50" size={64}>30</ProgressRing>
          <ProgressRing value={0.89} tone="sky" label="Удержание 89%" size={64}>89%</ProgressRing>
          <Spinner label="Загрузка" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton circle width={40} />
          <SkeletonText lines={2} className="flex-1" />
        </div>
      </Section>

      <Section title="Сообщения и уведомления">
        <div className="grid gap-3 sm:grid-cols-2">
          <Alert tone="info" title="Импорт идёт">Пришлём уведомление, когда будет готово.</Alert>
          <Alert tone="success" title="Сохранено">Пять слов добавлено в колоду.</Alert>
          <Alert tone="warning" title="Лимит Free">Использовано 2 из 3 текстов.</Alert>
          <Alert tone="error" title="Не получилось" live="assertive">У видео нет английских субтитров.</Alert>
          <Alert tone="ai" title="Концепт будущей функции">ИИ-репетитор пока не подключён.</Alert>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => toast.success("Слово добавлено в «Мозг»")}>Success</Button>
          <Button variant="ghost" size="sm" onClick={() => toast.error("Не удалось сохранить слово", { description: "Проверь соединение и повтори." })}>Error</Button>
          <Button variant="ghost" size="sm" onClick={() => toast.warning("Остался 1 текст на Free")}>Warning</Button>
          <Button variant="ghost" size="sm" onClick={() => toast.info("Новая неделя началась")}>Info</Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toast.success("Колода удалена", { action: { label: "Отменить", onClick: () => setLastAction("undo") } })}
          >
            С действием
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              toast.promise(new Promise<string>((resolve) => setTimeout(() => resolve("ok"), 900)), {
                loading: "Сохраняем…",
                success: "Сохранено",
              })
            }
          >
            Promise
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toast.fromResult({ ok: false, error: "Колода не найдена" }, {})}>Из результата</Button>
          <Button variant="ghost" size="sm" onClick={() => toast.dismiss()}>Закрыть все</Button>
        </div>
      </Section>

      <Section title="Состояния экрана">
        <div className="grid gap-4 md:grid-cols-2">
          <Card><LoadingState rows={2} /></Card>
          <Card><EmptyState icon={Plus} title="Колода пуста" body="Слова из чтения попадают сюда сами." /></Card>
          <Card><ErrorState title="Не получилось обработать видео" body="У этого видео нет субтитров на английском." code="YT-404" /></Card>
          <Card><OfflineState /></Card>
          <Card className="md:col-span-2"><NotFoundState /></Card>
        </div>
      </Section>
    </main>
  );
}
