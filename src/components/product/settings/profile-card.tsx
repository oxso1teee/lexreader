import SectionHeader from "@/components/product/section-header";
import { avatarInitials } from "@/lib/avatar-initials";

// M3 UI slice 2: profiles не хранит имя/аватар (docs/ui/slice2-data-audit.md
// §2) — карточка показывает только реально существующие поля, инициалы
// строятся из email, а не выдуманного имени.
export default function ProfileCard({
  email,
  targetLanguageName,
  nativeLanguageName,
  dailyWordGoal,
  createdAt,
  planLabel,
}: {
  email: string;
  targetLanguageName: string;
  nativeLanguageName: string;
  dailyWordGoal: number;
  createdAt: string;
  planLabel: string;
}) {
  const registeredDate = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(createdAt),
  );

  return (
    <section className="rounded-2xl bg-[var(--surface)] p-4 shadow-sm">
      <SectionHeader title="Профиль" />
      <div className="mt-3 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-forest/15 text-base font-semibold text-[var(--color-forest-text)]"
        >
          {avatarInitials(email)}
        </span>
        <div className="min-w-0">
          <p className="text-body truncate font-semibold">{email}</p>
          <p className="text-caption text-[var(--text-secondary)]">Регистрация: {registeredDate}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-caption text-[var(--text-secondary)]">Изучаю</dt>
          <dd className="text-body-sm font-medium">{targetLanguageName}</dd>
        </div>
        <div>
          <dt className="text-caption text-[var(--text-secondary)]">Родной язык</dt>
          <dd className="text-body-sm font-medium">{nativeLanguageName}</dd>
        </div>
        <div>
          <dt className="text-caption text-[var(--text-secondary)]">Цель в день</dt>
          <dd className="text-body-sm font-medium">{dailyWordGoal} слов</dd>
        </div>
        <div>
          <dt className="text-caption text-[var(--text-secondary)]">План</dt>
          <dd className="text-body-sm font-medium">{planLabel}</dd>
        </div>
      </dl>
    </section>
  );
}
