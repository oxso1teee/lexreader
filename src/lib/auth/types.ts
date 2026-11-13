// Общая форма ответа server actions, которые отправляют письмо со ссылкой
// (вход по ссылке из письма, сброс пароля). Одинаковая для обоих — тогда один
// экран «Проверь почту» и одна кнопка «Отправить ещё раз» работают с любым.
export interface EmailLinkState {
  /** Письмо отправлено (или мы показываем это одинаково для любого email — см. анти-перебор в actions). */
  sent?: boolean;
  /** Адрес, на который отправляли, — показывается на экране «Проверь почту». */
  email?: string;
  error?: string;
  retryAfterSeconds?: number;
}

export type EmailLinkAction = (prev: EmailLinkState, formData: FormData) => Promise<EmailLinkState>;
