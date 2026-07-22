interface FactCardProps {
  variant: "fact";
  icon: string;
  label: string;
  title: string;
  body: string;
  source: string;
}
interface TipCardProps {
  variant: "tip";
  icon: string;
  label: string;
  title: string;
  body: string;
}
interface RoadmapCardProps {
  variant: "roadmap";
  icon: string;
  label: string;
  title: string;
  items: string[];
}

type InfoCardProps = FactCardProps | TipCardProps | RoadmapCardProps;

export default function InfoCard(props: InfoCardProps) {
  if (props.variant === "fact") {
    return (
      <div className="rounded-2xl bg-card p-5 shadow-sm">
        <span className="text-3xl">{props.icon}</span>
        <p className="mt-2 text-xs font-semibold tracking-wide text-caramel uppercase">
          {props.label}
        </p>
        <h3 className="mt-1 text-lg font-bold">{props.title}</h3>
        <hr className="my-3 border-black/10 dark:border-white/10" />
        <p className="text-sm text-black/70 dark:text-white/70">{props.body}</p>
        <p className="mt-3 text-xs italic text-black/40 dark:text-white/40">{props.source}</p>
      </div>
    );
  }

  if (props.variant === "tip") {
    return (
      <div className="rounded-2xl bg-navy-card p-5 text-white shadow-sm">
        <span className="text-3xl">{props.icon}</span>
        <p className="mt-2 text-xs font-semibold tracking-wide text-yellow-400 uppercase">
          {props.label}
        </p>
        <h3 className="mt-1 text-lg font-bold">{props.title}</h3>
        <hr className="my-3 border-white/15" />
        <p className="text-sm text-white/75">{props.body}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-navy-card p-5 text-white shadow-sm">
      <span className="text-3xl">{props.icon}</span>
      <p className="mt-2 text-xs font-semibold tracking-wide text-sky-400 uppercase">
        {props.label}
      </p>
      <h3 className="mt-1 text-lg font-bold">{props.title}</h3>
      <hr className="my-3 border-white/15" />
      <ul className="flex flex-col gap-1.5 text-sm text-white/80">
        {props.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
