import { HomeIcon, PathIcon, MissionsIcon, ArenaIcon, LibraryIcon, ProfileIcon } from "@/components/nav-icons";
import { messages } from "@/lib/i18n";

// Единственный источник правды для навигации — DesktopSidebar и
// MobileBottomNav рендерят один и тот же список, чтобы labels/routes не
// разошлись между desktop и mobile.
//
// Gamified redesign: 6 items (was 5) matching the reference exactly --
// Home/Path/Missions/Arena/Library/Profile. /brain, /progress, /settings
// are still live routes (nothing deleted), just no longer bottom-nav
// entries: /brain is reached via the new Practice Hub (/practice), linked
// from Home; /progress's stats and /settings' account management are both
// linked from the new /profile page instead.
export interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType;
}

const nav = messages.appShell.nav;

export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: nav.home, Icon: HomeIcon },
  { href: "/learning-paths", label: nav.path, Icon: PathIcon },
  { href: "/missions", label: nav.missions, Icon: MissionsIcon },
  { href: "/arena", label: nav.arena, Icon: ArenaIcon },
  { href: "/library", label: nav.library, Icon: LibraryIcon },
  { href: "/profile", label: nav.profile, Icon: ProfileIcon },
];
