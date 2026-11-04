import { useEffect, useRef, useState } from "react";
import { fetchFile, modelThumbnailUrl } from "../../services/documentosApi";

// A few at a time: the first visit to the library may have to generate them on the server
const MAX_AT_ONCE = 3;
let running = 0;
const waiting: (() => void)[] = [];
const next = () => {
  if (running >= MAX_AT_ONCE) return;
  const job = waiting.shift();
  if (job) {
    running++;
    job();
  }
};

const loaded = new Map<number, string>(); // kept for the session: coming back to the library shouldn't load them again
export const clearThumbnailCache = () => loaded.clear();

function loadThumbnail(id: number): Promise<string> {
  const known = loaded.get(id);
  if (known) return Promise.resolve(known);
  return new Promise((resolve, reject) => {
    waiting.push(() => {
      fetchFile(modelThumbnailUrl(id))
        .then((url) => {
          loaded.set(id, url);
          resolve(url);
        })
        .catch(reject)
        .finally(() => {
          running--;
          next();
        });
    });
    next();
  });
}

// The model's first page, asked for only when its card reaches the screen. Without it the card still reads well.
export default function ModelThumb({ id, name }: { id: number; name: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(() => loaded.get(id) ?? null);
  const [state, setState] = useState<"waiting" | "failed">("waiting");

  useEffect(() => {
    if (url) return;
    let alive = true;
    const load = () =>
      loadThumbnail(id).then(
        (u) => alive && setUrl(u),
        () => alive && setState("failed")
      );
    if (typeof IntersectionObserver === "undefined" || !box.current) {
      load();
      return () => { alive = false; };
    }
    const seen = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          seen.disconnect();
          load();
        }
      },
      { rootMargin: "200px" }
    );
    seen.observe(box.current);
    return () => {
      alive = false;
      seen.disconnect();
    };
  }, [id, url]);

  return (
    <div ref={box} className={`gos-model-page${url ? "" : state === "failed" ? " is-empty" : " is-loading"}`}>
      {url ? <img src={url} alt={`Primera página de ${name}`} /> : <span aria-hidden="true" className="gos-model-page-icon">📄</span>}
    </div>
  );
}
