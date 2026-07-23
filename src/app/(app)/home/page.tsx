import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getPlan } from "@/lib/subscription";
import LanguageBanner from "./language-banner";
import PremiumCard from "./premium-card";
import WelcomeCard from "./welcome-card";
import InfoCard from "./info-card";

export default async function HomePage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  // Найдено при повторном аудите: карточка "Выберите ваш план" показывалась
  // и уже оплатившим Premium — выглядит так, будто оплата не сработала.
  const plan = await getPlan(supabase, profile.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-4 py-4">
      <LanguageBanner targetLanguage={profile.target_language} />
      {plan === "free" && <PremiumCard />}
      <WelcomeCard />

      <InfoCard
        variant="fact"
        icon="🧠"
        label="Science-based fact"
        title="Забывание не линейно"
        body="Эббингауз ещё в XIX веке показал: без повторения мы теряем большую часть новой информации за первые сутки. Повторение с растущими интервалами — самый надёжный способ закрепить слово в долгосрочной памяти."
        source="Основано на кривой забывания Эббингауза"
      />

      <InfoCard
        variant="fact"
        icon="🧠"
        label="Science-based fact"
        title="Понятный контекст важнее правил"
        body="Гипотеза «понятного ввода» Стивена Крашена: язык усваивается, когда мы понимаем чуть больше, чем уже знаем — а не когда зубрим грамматические правила отдельно от текста."
        source="Основано на Input Hypothesis, Krashen"
      />

      <InfoCard
        variant="tip"
        icon="💡"
        label="Learning tip"
        title="Читай то, что интересно"
        body="Выбирай тексты, которые ты бы читал(а) и на родном языке. Живой интерес держит внимание и заметно улучшает запоминание слов из контекста."
      />

      <InfoCard
        variant="fact"
        icon="🧠"
        label="Science-based fact"
        title="Чтение растит словарный запас"
        body="Активное чтение на изучаемом языке пополняет словарь быстрее, чем зубрёжка списков слов в отрыве от текста — новые слова закрепляются вместе со своим естественным контекстом."
        source="Основано на исследованиях extensive reading, Nation"
      />

      <InfoCard
        variant="tip"
        icon="💡"
        label="Learning tip"
        title="Не переводи каждое слово"
        body="Сначала попробуй понять смысл из контекста. Если останавливаться на каждом незнакомом слове, теряется связность текста — доверяй мозгу собрать картинку целиком."
      />

      <InfoCard
        variant="roadmap"
        icon="🚀"
        label="Coming soon"
        title="Что дальше в LexReader"
        items={[
          "🎧 Практика на слух",
          "📱 Приложения для iOS и Android",
          "🌍 Больше языков интерфейса",
          "💬 Практика разговора с ИИ",
        ]}
      />
    </div>
  );
}
