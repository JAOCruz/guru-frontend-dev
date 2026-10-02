import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { getAuthToken } from "../../utils";

// The tagged Word rendered in the page (docx-preview). Every {{TAG}} becomes a chip: empty (shows
// its label) or filled (shows the value, live). In review mode, selecting text reports the
// paragraph's text + offset so the server can tag exactly that span.

export interface DocSelection {
  text: string; // the paragraph's text, with tags as {{KEY}}
  offset: number;
  length: number;
  occurrence: number; // nth paragraph with this same text
  selected: string;
}

export interface DocxViewHandle {
  // scrolls to the nth place of a tag (cycles); returns how many places it has
  scrollTo: (key: string, n?: number) => number;
}

interface Props {
  url: string;
  values?: Record<string, string>;
  labels?: Record<string, string>;
  activeKey?: string | null;
  onTagClick?: (key: string) => void;
  onSelect?: (sel: DocSelection | null) => void; // review mode only
}

const TAG = /\{\{([^}]+)\}\}/g;
// parts the server's Word engine does not list (it only reads the body)
const OUTSIDE_BODY = "header, footer, [class*='footnote'], [class*='endnote'], [class*='comment']";
const bodyParagraphs = (root: HTMLElement) => Array.from(root.querySelectorAll("p")).filter((p) => !p.closest(OUTSIDE_BODY));
const flat = (s: string) => s.replace(/[  \t\n]/g, " ");

function wrapTags(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const n = walker.currentNode as Text;
    if (n.data.includes("{{")) nodes.push(n);
  }
  for (const node of nodes) {
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of node.data.matchAll(TAG)) {
      if (m.index! > last) frag.append(node.data.slice(last, m.index));
      const mark = document.createElement("mark");
      mark.className = "doc-tag";
      mark.dataset.tag = m[1].trim();
      frag.append(mark);
      last = m.index! + m[0].length;
    }
    if (last < node.data.length) frag.append(node.data.slice(last));
    node.replaceWith(frag);
  }
}

// The paragraph's text as the server sees it: tags as {{KEY}}, <br> as one space.
// With `stop`, returns the length of the text before that point instead.
function paraText(p: Element, stop?: { node: Node; offset: number }): string | number {
  let out = "";
  let done = false;
  const walk = (n: Node) => {
    if (done) return;
    if (stop && n === stop.node && n.nodeType === Node.ELEMENT_NODE) {
      Array.from(n.childNodes).slice(0, stop.offset).forEach(walk);
      done = true;
      return;
    }
    if (n instanceof HTMLElement && n.tagName === "MARK" && n.dataset.tag) {
      out += `{{${n.dataset.tag}}}`;
    } else if (n instanceof HTMLElement && n.tagName === "BR") {
      out += " ";
    } else if (n.nodeType === Node.TEXT_NODE) {
      const data = flat((n as Text).data);
      if (stop && n === stop.node) {
        out += data.slice(0, stop.offset);
        done = true;
        return;
      }
      out += data;
    } else {
      n.childNodes.forEach(walk);
    }
  };
  p.childNodes.forEach(walk);
  return stop ? out.length : out;
}

const DocxView = forwardRef<DocxViewHandle, Props>(function DocxView({ url, values = {}, labels = {}, activeKey, onTagClick, onSelect }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let alive = true;
    const el = box.current!;
    setState("loading");
    el.innerHTML = "";
    // each render goes into its own box, swapped in only if it is still the current one
    const target = document.createElement("div");
    fetch(url, { headers: { Authorization: `Bearer ${getAuthToken()}` }, credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.blob();
      })
      .then((blob) => renderAsync(blob, target, undefined, { inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true, useBase64URL: true }))
      .then(() => {
        if (!alive) return;
        wrapTags(target);
        el.replaceChildren(...Array.from(target.childNodes));
        setState("ready");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [url]);

  // fit the page width to the panel (measured once, before any zoom)
  useEffect(() => {
    const el = box.current!;
    const fit = () => {
      const wrap = el.querySelector<HTMLElement>(".docx-wrapper");
      const page = el.querySelector<HTMLElement>("section.docx");
      if (!wrap || !page) return;
      if (!wrap.dataset.width) wrap.dataset.width = String(page.offsetWidth);
      wrap.style.setProperty("zoom", String(Math.min(1, (el.clientWidth - 16) / Number(wrap.dataset.width))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [state]);

  // chips show the value (filled) or the label (empty)
  useEffect(() => {
    if (state !== "ready") return;
    box.current!.querySelectorAll<HTMLElement>("mark.doc-tag").forEach((m) => {
      const key = m.dataset.tag!;
      const v = values[key]?.trim();
      m.textContent = v || `[${labels[key] || key}]`;
      m.dataset.state = v ? "filled" : "empty";
      m.dataset.active = String(key === activeKey);
      m.title = labels[key] || key;
    });
  }, [values, labels, activeKey, state]);

  useImperativeHandle(ref, () => ({
    scrollTo(key, n = 0) {
      const marks = Array.from(box.current!.querySelectorAll<HTMLElement>("mark.doc-tag")).filter((m) => m.dataset.tag === key);
      if (!marks.length) return 0;
      const m = marks[n % marks.length];
      m.scrollIntoView({ block: "center", behavior: "smooth" });
      m.classList.remove("doc-tag-flash");
      void m.offsetWidth;
      m.classList.add("doc-tag-flash");
      return marks.length;
    },
  }));

  const onClick = (e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest<HTMLElement>("mark.doc-tag");
    if (mark && onTagClick) onTagClick(mark.dataset.tag!);
  };

  const onMouseUp = () => {
    if (!onSelect) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return onSelect(null);
    const range = sel.getRangeAt(0);
    const startEl = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : (range.startContainer as Element);
    const endEl = range.endContainer.nodeType === Node.TEXT_NODE ? range.endContainer.parentElement : (range.endContainer as Element);
    const p = startEl?.closest("p");
    if (!p || !box.current!.contains(p) || p.closest(OUTSIDE_BODY) || endEl?.closest("p") !== p || startEl?.closest("mark") || endEl?.closest("mark")) return onSelect(null);
    const text = paraText(p) as string;
    const start = paraText(p, { node: range.startContainer, offset: range.startOffset }) as number;
    const end = paraText(p, { node: range.endContainer, offset: range.endOffset }) as number;
    const selected = text.slice(start, end);
    if (!selected.trim() || selected.includes("{{")) return onSelect(null);
    // counted like the server: body paragraphs only (no headers, footers or notes), in document order
    const occurrence = bodyParagraphs(box.current!).filter((x) => paraText(x) === text).indexOf(p);
    onSelect({ text, offset: start, length: end - start, occurrence: Math.max(0, occurrence), selected });
  };

  return (
    <div className="relative h-full min-h-0">
      <style>{`
        .doc-view .docx-wrapper { background: transparent; padding: 8px 0; }
        .doc-view section.docx { box-shadow: 0 2px 10px rgba(0,0,0,.18); margin-bottom: 16px; }
        .doc-view mark.doc-tag { border-radius: 4px; padding: 0 3px; cursor: pointer; color: #1a1a1a; transition: background .2s, box-shadow .2s; }
        .doc-view mark.doc-tag[data-state="empty"] { background: #fde68a; font-style: italic; }
        .doc-view mark.doc-tag[data-state="filled"] { background: #bbf7d0; }
        .doc-view mark.doc-tag[data-active="true"] { box-shadow: 0 0 0 2px #2563eb; }
        .doc-view mark.doc-tag-flash { animation: docTagFlash 1.2s ease; }
        @keyframes docTagFlash { 0%,40% { box-shadow: 0 0 0 5px rgba(37,99,235,.55); } 100% { box-shadow: 0 0 0 2px #2563eb; } }
      `}</style>
      <div
        ref={box}
        className="doc-view h-full overflow-auto rounded-base bg-foreground/5"
        onClick={onClick}
        onMouseUp={onMouseUp}
        onTouchEnd={() => setTimeout(onMouseUp, 0)}
        data-testid="docx-view"
      />
      {state !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-foreground/60">
          {state === "loading" ? "Cargando el documento…" : "No se pudo mostrar el documento"}
        </div>
      )}
    </div>
  );
});

export default DocxView;
