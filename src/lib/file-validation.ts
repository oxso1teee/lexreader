// P0-SEC-03 release-readiness промта: `accept="image/*"` на <input> — только
// подсказка браузеру для диалога выбора файла, не защита (можно выбрать
// произвольный файл через "все файлы"). Проверяем реально на клиенте.

export const MAX_IMAGE_SIZE_BYTES = 5_000_000;

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Выбери файл изображения.";
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return "Файл слишком большой — максимум 5 МБ.";
  }
  return null;
}
