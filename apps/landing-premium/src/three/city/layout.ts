import * as THREE from "three";

/** Deterministic PRNG so the skyline is identical on every visit (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// World layout (metres-ish; the owl is ≈2.4 tall). The sea lies at z < SEA_Z, the Malecón avenue runs along it.
export const SEA_Z = -13;
export const MALECON_Z = -10; // centre of the seaside avenue
export const CITY = { xMin: -46, xMax: 46, zMin: -7.5, zMax: 34 };

/** Gurú office ("La Feria") and the client's door. */
export const OFFICE = { x: -24, z: 8, w: 4.2, d: 3.6, h: 4.2 };
export const DOOR = { x: 22, z: 0.5, w: 3.6, d: 3.2, h: 3.4 };

/** The flight route: office roof → over the Malecón → the client's door. */
export const ROUTE_POINTS = [
  new THREE.Vector3(OFFICE.x, OFFICE.h + 0.05, OFFICE.z),
  new THREE.Vector3(OFFICE.x + 2.5, OFFICE.h + 2.4, OFFICE.z - 3),
  new THREE.Vector3(-15, 8.5, -6),
  new THREE.Vector3(-6, 9.5, -15.5),
  new THREE.Vector3(4, 9.2, -17),
  new THREE.Vector3(12, 8.0, -10),
  new THREE.Vector3(18, 6.0, -3),
  new THREE.Vector3(DOOR.x, 3.9, DOOR.z + 2.4),
];

export const route = new THREE.CatmullRomCurve3(ROUTE_POINTS, false, "centripetal", 0.4);

export interface BuildingSpec {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  tone: number;
}

/** A skyline that leaves the Malecón, the office block, the door block and the route corridor free. */
export function buildSkyline(count: number, seed = 7): BuildingSpec[] {
  const r = rng(seed);
  const out: BuildingSpec[] = [];
  let tries = 0;
  const clear = (x: number, z: number, w: number, d: number) => {
    // keep the two landmarks and their forecourts free
    // (the takeoff and door cameras sit ≈14 in front of each landmark, on the +z side)
    if (Math.abs(x - OFFICE.x) < w / 2 + 7 && z + d / 2 > OFFICE.z - 7 && z - d / 2 < OFFICE.z + 17) return false;
    if (Math.abs(x - DOOR.x) < w / 2 + 9 && z + d / 2 > DOOR.z - 7 && z - d / 2 < DOOR.z + 19) return false;
    // the seaside avenue stays open
    if (z - d / 2 < MALECON_Z + 2.6) return false;
    for (const b of out) {
      if (Math.abs(b.x - x) < (b.w + w) / 2 + 0.9 && Math.abs(b.z - z) < (b.d + d) / 2 + 0.9) return false;
    }
    return true;
  };
  while (out.length < count && tries++ < count * 40) {
    const x = CITY.xMin + r() * (CITY.xMax - CITY.xMin);
    const z = CITY.zMin + r() * (CITY.zMax - CITY.zMin);
    const w = 1.8 + r() * 2.6;
    const d = 1.8 + r() * 2.6;
    // taller towards the centre / seafront, the odd tower
    const centre = 1 - Math.min(1, Math.abs(x) / 40);
    let h = 2.5 + r() * 4 + centre * r() * 6;
    if (r() < 0.12) h += 5 + r() * 6;
    // under the route the buildings stay low so the owl never clips them
    const p = route.getPointAt(Math.min(0.999, Math.max(0.001, (x - OFFICE.x) / (DOOR.x - OFFICE.x))));
    if (Math.abs(p.z - z) < 8 && h > p.y - 3) h = Math.max(2.5, p.y - 3.2 - r() * 2.5);
    // low blocks around the office so the takeoff / first follow shot stays open
    if (Math.hypot(x - OFFICE.x, z - OFFICE.z) < 15) h = Math.min(h, 3.6);
    if (!clear(x, z, w, d)) continue;
    out.push({ x, z, w, d, h, tone: r() });
  }
  return out;
}
