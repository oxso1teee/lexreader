import type { ReactNode, Ref } from "react";

// Заголовок шага. Это h1 страницы урока: при смене шага фокус переносится на
// него (tabIndex=-1, без попадания в Tab-порядок), и скринридер зачитывает
// новый шаг, а не молчит после нажатия «Далее».
export default function StepHeading({
  eyebrow,
  children,
  headingRef,
  id,
}: {
  eyebrow?: string;
  children: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
  id?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {eyebrow && <p className="ls-eyebrow">{eyebrow}</p>}
      <h1 ref={headingRef} id={id} tabIndex={-1} className="ls-title">
        {children}
      </h1>
    </div>
  );
}
