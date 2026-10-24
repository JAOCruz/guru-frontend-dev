import { useEffect, type RefObject } from "react";
import { useMotionValue, type MotionValue } from "framer-motion";

/**
 * 0 → 1 while a tall section scrolls past its sticky viewport.
 * JS-driven on purpose: framer-motion's accelerated scroll timelines map
 * opacity wrongly inside sticky sections (cards faded out at the end).
 */
export function useSectionProgress(ref: RefObject<HTMLElement | null>): MotionValue<number> {
  const progress = useMotionValue(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const p = travel > 0 ? -rect.top / travel : 0;
      progress.set(Math.min(1, Math.max(0, p)));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref, progress]);
  return progress;
}
