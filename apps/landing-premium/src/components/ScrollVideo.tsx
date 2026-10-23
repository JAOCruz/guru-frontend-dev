import { useEffect, useRef, useState } from "react";
import { useMotionValueEvent, type MotionValue } from "framer-motion";

export interface Source {
  /** the animation in AV1 (Chrome, Android, new iPhones), HEVC (Safari) and H.264 (anything else) */
  av1: string;
  hevc: string;
  h264: string;
  /** the same three, played backwards (so scrolling up plays instead of seeking) */
  rev: { av1: string; hevc: string; h264: string };
  start: string;
  end: string;
  /** which part stays in view when the screen's shape crops the video (CSS object-position) */
  focus?: string;
}

type Files = Pick<Source, "av1" | "hevc" | "h264">;

const CODECS: [keyof Files, string][] = [
  ["av1", 'video/mp4; codecs="av01.0.09M.08"'],
  ["hevc", 'video/mp4; codecs="hvc1.1.6.L123.90"'],
  ["h264", 'video/mp4; codecs="avc1.640032"'],
];

// the most efficient format this device decodes in hardware (smooth at fast playback rates);
// H.264 is hardware-decoded practically everywhere, so it is the safe answer
async function bestCodec(width: number, height: number): Promise<keyof Files> {
  const probe = document.createElement("video");
  const mc = navigator.mediaCapabilities;
  for (const [name, type] of CODECS) {
    if (name === "h264") break;
    if (probe.canPlayType(type) !== "probably" || !mc) continue;
    try {
      const info = await mc.decodingInfo({ type: "file", video: { contentType: type, width, height, bitrate: 4_000_000, framerate: 60 } });
      if (info.supported && info.smooth && info.powerEfficient) return name;
    } catch {
      /* unknown: keep looking */
    }
  }
  return "h264";
}

interface ScrollVideoProps {
  /** 0..1 scroll progress mapped onto the whole video */
  progress: MotionValue<number>;
  landscape: Source;
  portrait: Source;
  /** poses (0..1 of the video) where the animation comes to rest when the scroll stops; 0 and 1 always included */
  rests?: number[];
  /** start downloading once the stage is this close (IntersectionObserver rootMargin) */
  preloadMargin?: string;
  /** reduced motion: just the last frame */
  still?: boolean;
  label: string;
}

const IDLE_MS = 160; // no scroll for this long = the user stopped
const ARRIVED = 0.035; // seconds: close enough to the goal to stop
// The videos are 60 fps, so even at half speed a new frame shows about 30 times a second; slower than
// that it would look like jumping frame by frame. While scrolling it may run this far ahead (seconds) in
// the scroll's direction, so slow scrolling is one continuous flight instead of stop-and-go.
const MIN_RATE = 0.5;
const MAX_RATE = 6;
const LEAD = 0.5;

// A pre-rendered animation driven by the scroll. Instead of seeking frame by frame it *plays* toward
// the scroll position (the reversed copy when going up), faster when far and slower when close, and
// when the scroll stops it glides on to the next resting pose. The first frame shows at once as a poster.
export default function ScrollVideo({ progress, landscape, portrait, rests = [], preloadMargin = "150% 0px", still = false, label }: ScrollVideoProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const fwd = useRef<HTMLVideoElement>(null);
  const rev = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<Source | null>(null);
  const [codec, setCodec] = useState<keyof Files>("h264");
  const [near, setNear] = useState(false);
  const [revOn, setRevOn] = useState(false);
  const [showRev, setShowRev] = useState(false);

  const s = useRef({
    target: progress.get(), // 0..1 from the scroll
    lastInput: 0,
    dir: 0, // last scroll direction
    active: "fwd" as "fwd" | "rev",
    switching: false,
    rate: 1,
    seekOnly: false, // playback refused (iOS Low Power Mode): fall back to seeking
    seeking: false,
    inView: false,
    raf: 0,
  });
  const restList = useRef<number[]>([]);
  restList.current = [...new Set([0, ...rests, 1])].sort((a, b) => a - b);

  // the portrait cut for tall screens (phones, tablets upright), the wide one otherwise
  useEffect(() => {
    let alive = true;
    const pick = () => {
      const tall = window.innerWidth / window.innerHeight < 0.9;
      bestCodec(tall ? 1080 : 1920, tall ? 1920 : 1080).then((c) => {
        if (!alive) return;
        setCodec(c);
        setSrc(tall ? portrait : landscape);
      });
    };
    pick();
    window.addEventListener("orientationchange", pick);
    return () => {
      alive = false;
      window.removeEventListener("orientationchange", pick);
    };
  }, [landscape, portrait]);

  useEffect(() => {
    const el = wrap.current;
    if (!el || still) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: preloadMargin });
    // on screen or not: off screen it is not animated, just kept on the right frame
    const seen = new IntersectionObserver(([e]) => {
      s.current.inView = e.isIntersecting;
      kick();
    });
    io.observe(el);
    seen.observe(el);
    return () => {
      io.disconnect();
      seen.disconnect();
    };
  }, [preloadMargin, still]);

  // iOS only decodes after a user gesture: play/pause once on the first touch
  useEffect(() => {
    if (still) return;
    const unlock = () => {
      for (const v of [fwd.current, rev.current]) if (v) v.play().then(() => v.pause()).catch(() => {});
    };
    window.addEventListener("touchstart", unlock, { once: true, passive: true });
    return () => window.removeEventListener("touchstart", unlock);
  }, [still]);

  const duration = () => fwd.current?.duration || 0;
  // where the animation is now, in seconds of the forward video
  const position = () => {
    const st = s.current;
    if (st.active === "rev" && rev.current) return duration() - rev.current.currentTime;
    return fwd.current?.currentTime || 0;
  };

  const pauseAll = () => {
    fwd.current?.pause();
    rev.current?.pause();
  };

  // turn around: line the other copy up on the same frame, then swap what is shown
  const switchTo = (which: "fwd" | "rev", at: number) => {
    const st = s.current;
    const v = which === "fwd" ? fwd.current : rev.current;
    if (!v) return;
    st.switching = true;
    pauseAll();
    const done = () => {
      v.removeEventListener("seeked", done);
      st.active = which;
      st.switching = false;
      setShowRev(which === "rev");
      kick();
    };
    v.addEventListener("seeked", done);
    v.currentTime = which === "fwd" ? at : duration() - at;
  };

  const tick = () => {
    const st = s.current;
    st.raf = 0;
    const f = fwd.current;
    const dur = duration();
    if (!f || !dur || f.readyState < 2 || st.switching) {
      if (st.switching || (f && f.readyState < 2 && near)) st.raf = requestAnimationFrame(tick);
      return;
    }
    const idle = performance.now() - st.lastInput > IDLE_MS;
    const pos = position();
    const target = st.target * dur;
    let goal = target;
    if (!idle && st.dir !== 0) goal = Math.min(dur, Math.max(0, target + LEAD * st.dir));
    if (idle) {
      // glide on to the next resting pose in the direction of travel
      const rs = restList.current.map((r) => r * dur);
      goal = st.dir < 0 ? [...rs].reverse().find((r) => r <= target + 0.02) ?? 0 : rs.find((r) => r >= target - 0.02) ?? dur;
    } else if (st.dir !== 0 && Math.sign(goal - pos) !== st.dir) {
      goal = pos; // the animation is already ahead in this direction: wait for the scroll to catch up
    }
    const dist = goal - pos;

    if (Math.abs(dist) < ARRIVED) {
      pauseAll();
      if (!idle) st.raf = requestAnimationFrame(tick);
      return;
    }

    // nobody sees it: put it on the goal frame without animating
    if (!st.inView) {
      pauseAll();
      if (st.active !== "fwd") {
        switchTo("fwd", goal);
        return;
      }
      if (!st.seeking && Math.abs(f.currentTime - goal) > ARRIVED) {
        st.seeking = true;
        f.currentTime = goal;
      }
      return;
    }

    // fallback when playback is refused: step toward the goal by seeking
    if (st.seekOnly) {
      if (st.active !== "fwd") {
        switchTo("fwd", goal);
        return;
      }
      if (!st.seeking) {
        st.seeking = true;
        pauseAll();
        f.currentTime = pos + dist * 0.25;
      }
      st.raf = requestAnimationFrame(tick);
      return;
    }

    const revReady = Boolean(rev.current && rev.current.readyState >= 2);
    const want: "fwd" | "rev" = dist > 0 || !revReady ? "fwd" : "rev";
    if (dist < 0 && want === "fwd") {
      // the reversed copy is not here yet: step back by seeking
      if (!st.seeking) {
        st.seeking = true;
        f.pause();
        f.currentTime = pos + dist * 0.25;
      }
      st.raf = requestAnimationFrame(tick);
      return;
    }
    if (want !== st.active) {
      switchTo(want, pos);
      return;
    }

    // speed from the distance: far = faster, close = slower (never below MIN_RATE); finishing the move
    // to a resting pose at normal speed, easing down only at the very end
    const goalRate = idle ? Math.min(1, Math.max(MIN_RATE, Math.abs(dist) * 1.6)) : Math.min(MAX_RATE, Math.max(MIN_RATE, Math.abs(dist) * 2.2));
    st.rate += (goalRate - st.rate) * 0.18;
    const v = st.active === "fwd" ? f : rev.current!;
    v.playbackRate = Math.max(MIN_RATE, st.rate);
    if (v.paused) {
      v.play().catch(() => {
        st.seekOnly = true; // e.g. iOS Low Power Mode blocks playback: seek instead
      });
    }
    st.raf = requestAnimationFrame(tick);
  };

  function kick() {
    if (!s.current.raf) s.current.raf = requestAnimationFrame(tick);
  }

  useMotionValueEvent(progress, "change", (v) => {
    const st = s.current;
    const t = Math.min(1, Math.max(0, v));
    if (t !== st.target) st.dir = Math.sign(t - st.target);
    st.target = t;
    st.lastInput = performance.now();
    kick();
  });
  // keep ticking a little after the last scroll so the glide to the resting pose starts
  useEffect(() => {
    const id = window.setInterval(() => {
      if (performance.now() - s.current.lastInput < IDLE_MS + 400) kick();
    }, 120);
    return () => {
      window.clearInterval(id);
      cancelAnimationFrame(s.current.raf);
    };
  }, []);

  if (!src) return <div ref={wrap} className="absolute inset-0" />;
  if (still) return <img src={src.end} alt={label} style={{ objectPosition: src.focus }} className="absolute inset-0 h-full w-full object-cover" />;
  const cls = "absolute inset-0 h-full w-full object-cover";
  return (
    <div ref={wrap} className="absolute inset-0">
      <video
        ref={fwd}
        key={`f-${src[codec]}`}
        src={near ? src[codec] : undefined}
        poster={src.start}
        muted
        playsInline
        preload={near ? "auto" : "none"}
        aria-label={label}
        disablePictureInPicture
        onLoadedData={kick}
        onCanPlayThrough={() => setRevOn(true)}
        onSeeked={() => {
          s.current.seeking = false;
        }}
        style={{ objectPosition: src.focus, visibility: showRev ? "hidden" : "visible" }}
        className={cls}
      />
      {revOn && (
        <video
          ref={rev}
          key={`r-${src.rev[codec]}`}
          src={src.rev[codec]}
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          disablePictureInPicture
          style={{ objectPosition: src.focus, visibility: showRev ? "visible" : "hidden" }}
          className={cls}
        />
      )}
    </div>
  );
}
