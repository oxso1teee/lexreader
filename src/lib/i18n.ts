import ru from "../../messages/ru.json";

// M3 Slice 1 (docs/ui/unified-ui-slice-1-plan.md, Шаг 7): минимальная
// структура messages/ru.json + messages/en.json для строк App Shell и
// Today — только эти строки, не весь проект. Остальной проект остаётся
// на захардкоженном русском (как и был), профиль пользователя не хранит
// uiLocale — переключение локали не входит в этот слайс, en.json пока
// служит заготовкой набора ключей на будущее, а не подключённой опцией.
export const messages = ru;

export type Messages = typeof ru;
