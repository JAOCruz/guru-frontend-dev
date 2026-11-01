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
          <span aria-hidden="true">←</span> <span className="gos-back-label">{backLabel}</span>
        </button>
        <h2 className="gos-view-title font-heading">
          <span aria-hidden="true">{emoji}</span> <span className="gos-view-title-text">{title}</span>
        </h2>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="gos-view-body min-w-0 p-4 gos-md:p-6">{children}</div>
    </section>
  );
}
