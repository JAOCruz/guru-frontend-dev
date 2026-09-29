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
  /** sheets fly to the 3×3 grid */
  gridStart: 0.705,
  gridStagger: 0.013,
  gridDur: 0.17,
  /** the case drops out of frame */
  caseExit: [0.66, 0.84] as const,
  /** sheets → HTML cards */
  fade: [0.93, 0.985] as const,
  /** HTML grid becomes clickable */
  interactive: 0.95,
};

export const SHEETS = 9;

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
  compact: boolean;
  mobile: boolean;
}

/** Card centre in px from the stage centre (x right, y down) */
export function slotPx(layout: StageLayout, i: number) {
  const col = i % 3;
  const row = Math.floor(i / 3);
  return { x: (col - 1) * (layout.cardW + layout.gap), y: (row - 1) * (layout.cardH + layout.gap) };
}
