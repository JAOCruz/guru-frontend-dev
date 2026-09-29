// One window-level pointer listener shared by every owl stage (client px + normalized).
export const pointer = { x: 0, y: 0, cx: -1, cy: -1, active: false };
let bound = false;

export function bindPointer() {
  if (bound || typeof window === "undefined") return;
  bound = true;
  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.cx = e.clientX;
      pointer.cy = e.clientY;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
      pointer.active = true;
    },
    { passive: true },
  );
  window.addEventListener("pointerleave", () => (pointer.active = false));
}
