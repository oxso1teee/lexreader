import { BarChart3, Brain, House, Library, Settings, type LucideIcon } from "lucide-react";
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

export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: nav.today, Icon: House },
  { href: "/library", label: nav.learn, Icon: Library },
  { href: "/brain", label: nav.practice, Icon: Brain },
  { href: "/progress", label: nav.progress, Icon: BarChart3 },
  { href: "/settings", label: nav.profile, Icon: Settings },
];
