import * as THREE from "three";

/** Brand tokens (mirror src/index.css) */
export const INK = "#0b0b0c";
export const PAPER = "#f3f0e8";
export const GURU = "#1f3dff";
export const MINT = "#00c853";

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Deterministic PRNG so textures look the same on every visit */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Tileable value noise, `lattice` cells across a `size` px square */
function valueNoise(size: number, lattice: number, rnd: () => number): Float32Array {
  const grid = new Float32Array(lattice * lattice);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  const out = new Float32Array(size * size);
  const cell = size / lattice;
  for (let y = 0; y < size; y++) {
    const gy = y / cell;
    const y0 = Math.floor(gy);
    const fy = smooth(gy - y0);
    const y1 = (y0 + 1) % lattice;
    for (let x = 0; x < size; x++) {
      const gx = x / cell;
      const x0 = Math.floor(gx);
      const fx = smooth(gx - x0);
      const x1 = (x0 + 1) % lattice;
      const a = grid[y0 * lattice + x0];
      const b = grid[y0 * lattice + x1];
      const c = grid[y1 * lattice + x0];
      const d = grid[y1 * lattice + x1];
      out[y * size + x] = (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    }
  }
  return out;
}

export interface LeatherMaps {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

/**
 * Pebbled leather: fbm height field → colour variation, normal map and roughness.
 * All three tile, so they can repeat across the case without seams.
 */
export function makeLeatherMaps(base: THREE.ColorRepresentation, size = 512, repeat = 3): LeatherMaps {
  const rnd = mulberry32(1607);
  const octaves: [number, number][] = [
    [8, 0.42],
    [16, 0.26],
    [32, 0.16],
    [64, 0.1],
    [128, 0.06],
  ];
  const height = new Float32Array(size * size);
  for (const [lat, w] of octaves) {
    const n = valueNoise(size, lat, rnd);
    for (let i = 0; i < height.length; i++) height[i] += n[i] * w;
  }
  // pebble grain: fold the field so cells get a raised, rounded look
  let min = 1,
    max = 0;
  for (let i = 0; i < height.length; i++) {
    const v = 1 - Math.abs(height[i] * 2 - 1);
    height[i] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  for (let i = 0; i < height.length; i++) height[i] = (height[i] - min) / (max - min);

  const col = new THREE.Color(base);
  const mapC = canvas(size, size);
  const normC = canvas(size, size);
  const roughC = canvas(size, size);
  const mapCtx = mapC.getContext("2d")!;
  const normCtx = normC.getContext("2d")!;
  const roughCtx = roughC.getContext("2d")!;
  const mapImg = mapCtx.createImageData(size, size);
  const normImg = normCtx.createImageData(size, size);
  const roughImg = roughCtx.createImageData(size, size);
  const strength = 2.4;
  for (let y = 0; y < size; y++) {
    const yu = (y - 1 + size) % size;
    const yd = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const xl = (x - 1 + size) % size;
      const xr = (x + 1) % size;
      const h = height[i];
      const dx = (height[y * size + xr] - height[y * size + xl]) * strength;
      const dy = (height[yd * size + x] - height[yu * size + x]) * strength;
      const len = Math.hypot(dx, dy, 1);
      const nx = -dx / len;
      const ny = -dy / len;
      const nz = 1 / len;
      const o = i * 4;
      normImg.data[o] = (nx * 0.5 + 0.5) * 255;
      normImg.data[o + 1] = (ny * 0.5 + 0.5) * 255;
      normImg.data[o + 2] = (nz * 0.5 + 0.5) * 255;
      normImg.data[o + 3] = 255;
      // slightly lighter on the bumps, darker in the creases
      const tone = 0.8 + h * 0.34;
      mapImg.data[o] = Math.min(255, col.r * 255 * tone);
      mapImg.data[o + 1] = Math.min(255, col.g * 255 * tone);
      mapImg.data[o + 2] = Math.min(255, col.b * 255 * tone);
      mapImg.data[o + 3] = 255;
      const r = (0.5 + (1 - h) * 0.32) * 255;
      roughImg.data[o] = r;
      roughImg.data[o + 1] = r;
      roughImg.data[o + 2] = r;
      roughImg.data[o + 3] = 255;
    }
  }
  mapCtx.putImageData(mapImg, 0, 0);
  normCtx.putImageData(normImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);

  const setup = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: setup(mapC, true), normalMap: setup(normC, false), roughnessMap: setup(roughC, false) };
}

/** Dark blue lining with fine diagonal stripes (same motif as the old CSS lid) */
export function makeLiningTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = canvas(size, size);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#15206b";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#1c2c8f";
  ctx.lineWidth = 14;
  for (let d = -size; d < size * 2; d += 36) {
    ctx.beginPath();
    ctx.moveTo(d, 0);
    ctx.lineTo(d + size, size);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Brushed gold plate with a debossed "GURÚ SOLUCIONES" */
export function drawPlate(c: HTMLCanvasElement) {
  const w = c.width;
  const h = c.height;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#f2dc9a");
  g.addColorStop(0.35, "#d6b35a");
  g.addColorStop(0.55, "#f6e6b0");
  g.addColorStop(0.8, "#c9a24a");
  g.addColorStop(1, "#e7cc80");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // brushed grain
  ctx.globalAlpha = 0.18;
  for (let y = 0; y < h; y += 2) {
    ctx.fillStyle = Math.random() > 0.5 ? "#fff3c4" : "#a8842e";
    ctx.fillRect(0, y, w, 1);
  }
  ctx.globalAlpha = 1;
  // bevelled border
  ctx.lineWidth = h * 0.045;
  ctx.strokeStyle = "rgba(120,90,20,0.55)";
  ctx.strokeRect(h * 0.09, h * 0.09, w - h * 0.18, h - h * 0.18);
  ctx.lineWidth = h * 0.02;
  ctx.strokeStyle = "rgba(255,245,200,0.7)";
  ctx.strokeRect(h * 0.13, h * 0.13, w - h * 0.26, h - h * 0.26);
  // debossed text: light offset below-right, dark text on top
  const text = "GURÚ SOLUCIONES";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = h * 0.34;
  ctx.font = `900 ${size}px Unbounded, "Space Grotesk", system-ui, sans-serif`;
  const maxW = w * 0.8;
  if (ctx.measureText(text).width > maxW) {
    size *= maxW / ctx.measureText(text).width;
    ctx.font = `900 ${size}px Unbounded, "Space Grotesk", system-ui, sans-serif`;
  }
  ctx.fillStyle = "rgba(255,246,210,0.75)";
  ctx.fillText(text, w / 2 + h * 0.018, h * 0.45 + h * 0.018);
  ctx.fillStyle = "#4a3410";
  ctx.fillText(text, w / 2, h * 0.45);
  ctx.font = `600 ${h * 0.13}px "Inter Tight", system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,246,210,0.7)";
  ctx.fillText("SANTO DOMINGO · RD", w / 2 + h * 0.012, h * 0.76 + h * 0.012);
  ctx.fillStyle = "#5a4012";
  ctx.fillText("SANTO DOMINGO · RD", w / 2, h * 0.76);
}

export function makePlateTexture(): THREE.CanvasTexture {
  const c = canvas(1024, 288);
  drawPlate(c);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width <= maxW || !cur) cur = test;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    let last = cut[maxLines - 1];
    while (last.length && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1).trimEnd();
    cut[maxLines - 1] = `${last}…`;
    return cut;
  }
  return lines;
}

export interface SheetSpec {
  index: number;
  name: string;
  description: string;
  /** Serialized lucide SVG copied from the HTML card so the glyph matches exactly */
  iconSvg?: string;
  cardW: number;
  cardH: number;
  compact: boolean;
}

const iconCache = new Map<string, Promise<HTMLImageElement>>();
function loadIcon(svg: string): Promise<HTMLImageElement> {
  let p = iconCache.get(svg);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      const painted = svg.replace(/stroke="currentColor"/g, `stroke="${GURU}"`).replace(/fill="currentColor"/g, `fill="${GURU}"`);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(painted)}`;
    });
    iconCache.set(svg, p);
  }
  return p;
}

/**
 * Draws one service sheet so it matches the HTML card pixel for pixel
 * (2px ink border, 16px radius, blue header with number + GURÚ, icon, title, copy).
 * Resolves once the icon image is drawn; text is drawn synchronously.
 */
export async function drawSheet(c: HTMLCanvasElement, spec: SheetSpec): Promise<void> {
  const S = c.width / spec.cardW;
  const W = c.width;
  const H = c.height;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  // border + white body
  roundRect(ctx, 0, 0, W, H, 16 * S);
  ctx.fillStyle = INK;
  ctx.fill();
  roundRect(ctx, 2 * S, 2 * S, W - 4 * S, H - 4 * S, 14 * S);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.save();
  ctx.clip();
  // header
  const headH = 28 * S;
  ctx.fillStyle = GURU;
  ctx.fillRect(2 * S, 2 * S, W - 4 * S, headH);
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `700 ${11 * S}px Unbounded, system-ui, sans-serif`;
  ctx.fillText(String(spec.index + 1).padStart(2, "0"), 14 * S, 2 * S + headH / 2 + 0.5 * S);
  ctx.textAlign = "right";
  ctx.font = `700 ${11 * S}px "Inter Tight", system-ui, sans-serif`;
  ctx.globalAlpha = 0.8;
  ctx.fillText("GURÚ", W - 14 * S, 2 * S + headH / 2 + 0.5 * S);
  ctx.globalAlpha = 1;
  ctx.restore();

  const bodyTop = 2 * S + headH;
  const bodyH = H - 2 * S - bodyTop;
  let iconBox = { x: 0, y: 0, size: 28 * S };
  if (spec.compact) {
    // centred column: icon 24, gap 6, title 10px (≤3 lines)
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = `700 ${10 * S}px Unbounded, system-ui, sans-serif`;
    const lines = wrapLines(ctx, spec.name.toUpperCase(), W - 4 * S - 12 * S, 3);
    const lh = 12.5 * S;
    const total = 24 * S + 6 * S + lines.length * lh;
    let y = bodyTop + (bodyH - total) / 2;
    iconBox = { x: W / 2 - 12 * S, y, size: 24 * S };
    y += 24 * S + 6 * S;
    ctx.fillStyle = INK;
    for (const l of lines) {
      ctx.fillText(l, W / 2, y + lh * 0.78);
      y += lh;
    }
  } else {
    const pad = 16 * S;
    const x = 2 * S + pad;
    let y = bodyTop + pad;
    iconBox = { x, y, size: 28 * S };
    y += 28 * S + 8 * S;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `700 ${15 * S}px Unbounded, system-ui, sans-serif`;
    const maxW = W - 4 * S - 2 * pad;
    const title = wrapLines(ctx, spec.name.toUpperCase(), maxW, 2);
    const tlh = 18.75 * S;
    ctx.fillStyle = INK;
    for (const l of title) {
      ctx.fillText(l, x, y + tlh * 0.78);
      y += tlh;
    }
    y += 8 * S;
    ctx.font = `400 ${13 * S}px "Inter Tight", system-ui, sans-serif`;
    ctx.fillStyle = "rgba(11,11,12,0.7)";
    const dlh = 17.9 * S;
    const desc = wrapLines(ctx, spec.description, maxW, 2);
    for (const l of desc) {
      if (y + dlh > H - 2 * S - 6 * S) break;
      ctx.fillText(l, x, y + dlh * 0.76);
      y += dlh;
    }
  }
  if (spec.iconSvg) {
    try {
      const img = await loadIcon(spec.iconSvg);
      ctx.drawImage(img, iconBox.x, iconBox.y, iconBox.size, iconBox.size);
    } catch {
      /* the glyph is decorative; the title carries the meaning */
    }
  }
}

/** Plain paper back for the sheets (no text, so nothing reads mirrored) */
export function makePaperBackTexture(cardW: number, cardH: number): THREE.CanvasTexture {
  const S = 2;
  const c = canvas(Math.round(cardW * S), Math.round(cardH * S));
  const ctx = c.getContext("2d")!;
  roundRect(ctx, 0, 0, c.width, c.height, 16 * S);
  ctx.fillStyle = INK;
  ctx.fill();
  roundRect(ctx, 2 * S, 2 * S, c.width - 4 * S, c.height - 4 * S, 14 * S);
  ctx.fillStyle = "#efece4";
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function fontsReady(): Promise<unknown> {
  if (!("fonts" in document)) return Promise.resolve();
  return Promise.all([
    document.fonts.load("700 20px Unbounded"),
    document.fonts.load("900 20px Unbounded"),
    document.fonts.load('700 20px "Inter Tight"'),
    document.fonts.load('400 20px "Inter Tight"'),
  ]).catch(() => undefined);
}
