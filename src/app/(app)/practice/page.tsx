import Link from "next/link";
import PageHeader from "@/components/product/page-header";

// Gamified redesign — Practice Hub: a routing hub, not a new practice
// system. Every card links to an existing or newly-added real route;
// nothing here is a fake button. Words Lab and Story Corner point at
// LexReader's existing, mature systems (Brain/SRS and Library/Reader);
// Grammar Gym/Listen Lounge/Speak Studio are the genuinely new routes this
// redesign adds (see docs/ui plan). Reached from a card on /home rather
// than its own bottom-nav tab, matching the reference's 6-item nav
// (Home/Path/Missions/Arena/Library/Profile).
const CARDS = [
  {
    href: "/brain",
    icon: "📚",
    title: "Words Lab",
    subtitle: "Слова и повторение по расписанию",
  },
  {
    href: "/grammar",
    icon: "🏋️",
    title: "Grammar Gym",
    subtitle: "Грамматика в упражнениях",
  },
  {
    href: "/listen",
    icon: "🎧",
    title: "Listen Lounge",
    subtitle: "Слушай и понимай на слух",
  },
  {
    href: "/speak",
    icon: "🎙️",
    title: "Speak Studio",
    subtitle: "Говори и получай разбор",
  },
  {
    href: "/library",
    icon: "📖",
    title: "Story Corner",
    subtitle: "Читай и улучшай понимание",
  },
] as const;

export default function PracticeHubPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <PageHeader title="Практика" />
      <div className="grid grid-cols-2 gap-3">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="focus-ring flex flex-col gap-2 rounded-2xl bg-[var(--surface)] p-4 shadow-sm transition-transform hover:-translate-y-0.5"
          >
            <span className="text-2xl" aria-hidden="true">
              {card.icon}
            </span>
            <span className="text-body font-bold">{card.title}</span>
            <span className="text-caption text-[var(--text-secondary)]">{card.subtitle}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
