import { HomeIcon, LibraryIcon, BrainIcon, ProgressIcon, SettingsIcon } from "@/components/nav-icons";
import { messages } from "@/lib/i18n";

// Единственный источник правды для навигации — DesktopSidebar и
// MobileBottomNav рендерят один и тот же список, чтобы labels/routes не
// разошлись между desktop и mobile (docs/ui/route-map.md: те же 5
// существующих routes, только новые labels новой IA).
export interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType;
}

const nav = messages.appShell.nav;

export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: nav.today, Icon: HomeIcon },
  { href: "/library", label: nav.learn, Icon: LibraryIcon },
  { href: "/brain", label: nav.practice, Icon: BrainIcon },
  { href: "/progress", label: nav.progress, Icon: ProgressIcon },
  { href: "/settings", label: nav.profile, Icon: SettingsIcon },
];
