import { useEffect, useRef, useState } from "react";
import { useMotionValueEvent, type MotionValue } from "framer-motion";

interface Source { video: string; start: string; end: string }

interface ScrollVideoProps {
  /** 0..1 scroll progress mapped onto the whole video */
  progress: MotionValue<number>;
  landscape: Source;
  portrait: Source;
  /** start downloading once the stage is this close (IntersectionObserver rootMargin) */
  preloadMargin?: string;
  /** reduced motion: just the last frame */
  still?: boolean;
  label: string;
}

// A pre-rendered animation that plays forward and back with the scroll (like a flipbook). The first
// frame shows at once as a poster; the video downloads ahead of time and eases toward the scroll.
export default function ScrollVideo({ progress, landscape, portrait, preloadMargin = "150% 0px", still = false, label }: ScrollVideoProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<Source | null>(null);
  const [near, setNear] = useState(false);
  const target = useRef(progress.get());
  const current = useRef(-1);
  const seeking = useRef(false);
  const raf = useRef(0);

  // the portrait cut for tall screens (phones, tablets upright), the wide one otherwise
  useEffect(() => {
    const pick = () => setSrc(window.innerWidth / window.innerHeight < 0.9 ? portrait : landscape);
    pick();
    window.addEventListener("orientationchange", pick);
    return () => window.removeEventListener("orientationchange", pick);
  }, [landscape, portrait]);

  useEffect(() => {
    const el = wrap.current;
    if (!el || still) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: preloadMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [preloadMargin, still]);

  // iOS only decodes frames after a user gesture: play/pause once on the first touch
  useEffect(() => {
    if (still) return;
    const unlock = () => {
      const v = video.current;
      if (v) v.play().then(() => v.pause()).catch(() => {});
    };
    window.addEventListener("touchstart", unlock, { once: true, passive: true });
    return () => window.removeEventListener("touchstart", unlock);
  }, [still]);

  const tick = () => {
    raf.current = 0;
    const v = video.current;
    if (!v || !v.duration || v.readyState < 1) return;
    const goal = target.current;
    current.current = current.current < 0 ? goal : current.current + (goal - current.current) * 0.22;
    if (Math.abs(goal - current.current) < 0.0008) current.current = goal;
    if (!seeking.current) {
      const t = current.current * (v.duration - 0.04);
      if (Math.abs(v.currentTime - t) > 0.01) {
        seeking.current = true;
        v.currentTime = t;
      }
    }
    if (current.current !== goal || seeking.current) raf.current = requestAnimationFrame(tick);
  };
  const kick = () => {
    if (!raf.current) raf.current = requestAnimationFrame(tick);
  };

  useMotionValueEvent(progress, "change", (v) => {
    target.current = Math.min(1, Math.max(0, v));
    kick();
  });
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  if (!src) return <div ref={wrap} className="absolute inset-0" />;
  if (still) return <img src={src.end} alt={label} className="absolute inset-0 h-full w-full object-cover" />;
  return (
    <div ref={wrap} className="absolute inset-0">
      <video
        ref={video}
        key={src.video}
        src={near ? src.video : undefined}
        poster={src.start}
        muted
        playsInline
        preload={near ? "auto" : "none"}
        aria-label={label}
        disablePictureInPicture
        onLoadedMetadata={kick}
        onSeeked={() => {
          seeking.current = false;
          kick();
        }}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
