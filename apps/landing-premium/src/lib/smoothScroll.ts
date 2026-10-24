import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Premium smooth scrolling (Lenis) kept in sync with GSAP ScrollTrigger. It moves the real
// window scroll, so the pinned 3D sections that read window.scrollY keep working. Skipped for
// people who ask for reduced motion and on touch devices (native scrolling feels better there).
export function startSmoothScroll() {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (window.matchMedia("(pointer: coarse)").matches) return;

  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, anchors: { offset: -80 } });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
}
