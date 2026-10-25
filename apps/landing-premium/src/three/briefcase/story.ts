/**
 * Scroll story for the briefcase section. Progress p ∈ [0,1] across the pinned section.
 * Shared by the WebGL scene and the HTML overlay so the crossfade lines up.
 */
export const STORY = {
  /** the closed case turns towards the camera */
  turn: [0, 0.2] as const,
  /** the two clasps pop up */
  clasps: [0.1, 0.17] as const,
  /** lid swings open */
  lid: [0.15, 0.34] as const,
  /** sheets rise one by one */
  riseStart: 0.28,
  riseStagger: 0.034,
  riseDur: 0.15,
  /** sheets fly to the grid (5×2 on wide screens, 2×5 on phones) */
  gridStart: 0.705,
  gridStagger: 0.011,
  gridDur: 0.17,
  /** the case drops out of frame */
  caseExit: [0.66, 0.84] as const,
  /** sheets → HTML cards */
  fade: [0.93, 0.985] as const,
  /** HTML grid becomes clickable */
  interactive: 0.95,
};

import { SERVICES } from "../../data";

/** One sheet per service */
export const SHEETS = SERVICES.length;

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** 0→1 as p goes a→b */
export const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
export const easeOutBack = (t: number, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

export function riseT(p: number, i: number) {
  const a = STORY.riseStart + i * STORY.riseStagger;
  return seg(p, a, a + STORY.riseDur);
}
export function gridT(p: number, i: number) {
  const a = STORY.gridStart + i * STORY.gridStagger;
  return seg(p, a, a + STORY.gridDur);
}

/** Pixel layout of the HTML grid, shared with the scene so sheets land on the cards */
export interface StageLayout {
  stageW: number;
  stageH: number;
  cardW: number;
  cardH: number;
  gap: number;
  /** image only, no title or copy (narrow cards) */
  compact: boolean;
  mobile: boolean;
  cols: number;
}

/** Card centre in px from the stage centre (x right, y down); a short last row is centred */
export function slotPx(layout: StageLayout, i: number, count = SHEETS) {
  const { cols } = layout;
  const rows = Math.ceil(count / cols);
  const row = Math.floor(i / cols);
  const inRow = Math.min(cols, count - row * cols);
  const col = i % cols;
  return {
    x: (col - (inRow - 1) / 2) * (layout.cardW + layout.gap),
    y: (row - (rows - 1) / 2) * (layout.cardH + layout.gap),
  };
}

/** Body below the image on full cards: title (2 lines) + copy (2 lines) */
export const CARD_BODY_H = 92;

/**
 * Card size for a stage: 5 columns on wide screens, 2 on phones, each card a 16:9 service image
 * (plus its title and copy when there is room), shrunk until every row fits the stage height.
 */
export function cardLayout(w: number, h: number, count = SHEETS): StageLayout {
  const mobile = w < 640;
  const cols = mobile ? 2 : 5;
  const gap = mobile ? 10 : 18;
  const rows = Math.ceil(count / cols);
  let cardW = mobile ? Math.floor((w - 32 - (cols - 1) * gap) / cols) : Math.min(250, Math.floor((w - 64 - (cols - 1) * gap) / cols));
  const heightOf = (cw: number) => {
    const compact = cw < 200;
    return { compact, cardH: Math.round((cw - 4) * (9 / 16)) + 4 + (compact ? 0 : CARD_BODY_H) };
  };
  let { compact, cardH } = heightOf(cardW);
  const room = h * 0.94;
  while (cardW > 80 && rows * cardH + (rows - 1) * gap > room) {
    cardW -= 4;
    ({ compact, cardH } = heightOf(cardW));
  }
  return { stageW: w, stageH: h, cardW, cardH, gap, compact, mobile, cols };
}
