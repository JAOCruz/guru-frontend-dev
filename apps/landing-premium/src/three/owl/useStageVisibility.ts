import { useEffect, useState, type RefObject } from "react";

/**
 * `near`: the element is within `margin` of the viewport (mount the canvas).
 * `visible`: the element intersects the viewport AND the tab is visible (run the frameloop).
 */
export function useStageVisibility(ref: RefObject<HTMLElement | null>, margin = "300px 0px") {
  const [near, setNear] = useState(false);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting);
        if (e.isIntersecting) setNear(true);
      },
      { rootMargin: margin },
    );
    io.observe(el);
    const onVis = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ref, margin]);

  return { near, visible: inView && tabVisible };
}
