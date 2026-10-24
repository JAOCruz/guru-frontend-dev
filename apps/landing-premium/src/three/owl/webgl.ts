// Small runtime capability helpers shared by the owl stages.

let webglResult: boolean | null = null;

/** True when the browser can create a WebGL2/WebGL context (checked once). */
export function hasWebGL(): boolean {
  if (webglResult !== null) return webglResult;
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    webglResult = !!gl;
    (gl as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglResult = false;
  }
  return webglResult;
}

export function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** DPR cap: ≈1.75 on desktop, 1.25 on phones. */
export function dprRange(): [number, number] {
  return [1, isMobileViewport() ? 1.25 : 1.75];
}
