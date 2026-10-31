import type { ReactNode } from "react";

// The "slide over" frame of Gurú OS: a header bar with «← Volver al menú» and the view's
// emoji + uppercase blue title, then the content. Natural height (the page scrolls).
export default function FullView({ emoji, title, onBack, backLabel = "Volver al menú", actions, children }: {
  emoji: string;
  title: string;
  onBack: () => void;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col">
      <div className="gos-view-head">
        <button type="button" onClick={onBack} className="gos-back">
          <span aria-hidden="true">←</span> {backLabel}
        </button>
        <h2 className="gos-view-title font-heading">
          <span aria-hidden="true">{emoji}</span> {title}
        </h2>
        {actions && <div className="flex basis-full items-center gap-2 sm:basis-auto">{actions}</div>}
      </div>
      <div className="min-w-0 p-4 md:p-6">{children}</div>
    </section>
  );
}
