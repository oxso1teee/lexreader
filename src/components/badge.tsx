const VARIANTS = {
  due: "bg-accent-soft text-accent-strong",
  new: "bg-success-soft text-success",
  premium: "bg-well text-[#eee6d6]",
} as const;

export default function Badge({
  variant,
  children,
}: {
  variant: keyof typeof VARIANTS;
  children: React.ReactNode;
}) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${VARIANTS[variant]}`}>
      {children}
    </span>
  );
}
