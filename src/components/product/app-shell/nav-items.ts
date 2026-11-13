import { BarChart3, BookOpen, Copy, House, UserRound, type LucideIcon } from "lucide-react";
import { messages } from "@/lib/i18n";

// Единственный источник правды для навигации — DesktopSidebar и
// MobileBottomNav рендерят один и тот же список, чтобы labels/routes не
// разошлись между desktop и mobile (docs/ui/route-map.md: те же 5
// существующих routes, только новые labels новой IA).
export interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

const nav = messages.appShell.nav;

// docs/moments/ROADMAP.md, этап 8 — "Учиться" ведёт на карту пути
// (/learning-paths, при активном пути редиректит на PathMap), не на
// библиотеку: Path.dc.html's нижняя навигация. /library остаётся
// достижима из других мест (карточки "Продолжить чтение", /read, /watch,
// учебные материалы) — grep подтвердил несколько живых ссылок.
export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: nav.today, Icon: House },
  { href: "/learning-paths", label: nav.learn, Icon: BookOpen },
  { href: "/brain", label: nav.practice, Icon: Copy },
  { href: "/progress", label: nav.progress, Icon: BarChart3 },
  { href: "/settings", label: nav.profile, Icon: UserRound },
];
