// profiles не хранит имя (docs/ui/slice2-data-audit.md §2) — единственный
// честный источник для инициалов это email из auth.users, не выдумываем имя.
export function avatarInitials(email: string): string {
  const local = email.split("@")[0]?.trim() ?? "";
  if (!local) return "?";
  const letters = local.match(/[a-zA-Z0-9]/g) ?? [];
  if (letters.length === 0) return "?";
  return letters.slice(0, 2).join("").toUpperCase();
}
