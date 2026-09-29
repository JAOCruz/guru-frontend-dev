import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from "react";
import * as THREE from "three";
import { Line, RoundedBox } from "@react-three/drei";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { makeLeatherMaps, makeLiningTexture, makePlateTexture, drawPlate, fontsReady } from "./textures";
import { STORY, seg, lerp, easeOutBack, easeInOutSine } from "./story";

/** Case dimensions in scene units (1 = case width) */
export const CASE = {
  W: 1.0,
  D: 0.68,
  bodyH: 0.17,
  lidH: 0.085,
  wall: 0.036,
  R: 0.06,
  bevel: 0.01,
  /** y of the lining floor inside the body */
  floorY: 0.03,
  lidOpen: 1.92,
};

export interface BriefcaseHandle {
  update(p: number, t: number): void;
}

function roundedRect(w: number, d: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Points of a rounded rectangle in the XZ plane at height y (for the stitching) */
function stitchLoop(w: number, d: number, r: number, y: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  const hw = w / 2 - r;
  const hd = d / 2 - r;
  const corners: [number, number, number][] = [
    [hw, hd, 0],
    [-hw, hd, Math.PI / 2],
    [-hw, -hd, Math.PI],
    [hw, -hd, (3 * Math.PI) / 2],
  ];
  const n = 6;
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]);
    }
  }
  pts.push(pts[0]);
  return pts;
}

function useCaseMaterials(mobile: boolean) {
  const mats = useMemo(() => {
    const leatherMaps = makeLeatherMaps("#5c2f14", mobile ? 256 : 512, 3);
    const leather = new THREE.MeshPhysicalMaterial({
      color: "#7d4220",
      map: leatherMaps.map,
      normalMap: leatherMaps.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: leatherMaps.roughnessMap,
      roughness: 1,
      metalness: 0,
      sheen: 0.55,
      sheenColor: new THREE.Color("#d29a63"),
      sheenRoughness: 0.75,
      clearcoat: 0.18,
      clearcoatRoughness: 0.55,
      envMapIntensity: 0.55,
    });
    const leatherDark = leather.clone();
    leatherDark.color.set("#4d2812");
    leatherDark.sheen = 0.3;
    const gold = new THREE.MeshPhysicalMaterial({
      color: "#dcb55e",
      metalness: 1,
      roughness: 0.34,
      anisotropy: mobile ? 0 : 0.7,
      clearcoat: 0.25,
      clearcoatRoughness: 0.3,
      envMapIntensity: 1.1,
    });
    const lining = new THREE.MeshStandardMaterial({
      map: makeLiningTexture(),
      color: "#ffffff",
      roughness: 0.92,
      metalness: 0,
      side: THREE.BackSide,
      envMapIntensity: 0.2,
    });
    const liningFlat = lining.clone();
    liningFlat.side = THREE.FrontSide;
    const ink = new THREE.MeshStandardMaterial({ color: "#141416", roughness: 0.6, metalness: 0.1 });
    const plateTex = makePlateTexture();
    const plateTop = new THREE.MeshPhysicalMaterial({
      map: plateTex,
      color: "#ffffff",
      metalness: 0.95,
      roughness: 0.28,
      clearcoat: 0.4,
      clearcoatRoughness: 0.2,
      envMapIntensity: 1.0,
    });
    // BoxGeometry face order: +x, -x, +y (top, carries the plate art), -y, +z, -z
    const plateFaces = [gold, gold, plateTop, gold, gold, gold];
    return { leather, leatherDark, gold, lining, liningFlat, ink, plateTop, plateTex, leatherMaps, plateFaces };
  }, [mobile]);

  // redraw the plate once the brand font is available
  useEffect(() => {
    let alive = true;
    fontsReady().then(() => {
      if (!alive) return;
      drawPlate(mats.plateTex.image as HTMLCanvasElement);
      mats.plateTex.needsUpdate = true;
    });
    return () => {
      alive = false;
    };
  }, [mats]);

  useEffect(
    () => () => {
      for (const m of Object.values(mats)) {
        if (m instanceof THREE.Material || m instanceof THREE.Texture) m.dispose();
      }
      mats.leatherMaps.map.dispose();
      mats.leatherMaps.normalMap.dispose();
      mats.leatherMaps.roughnessMap.dispose();
    },
    [mats],
  );
  return mats;
}

const STITCH = { color: "#e6c69c", lineWidth: 1.3, dashSize: 0.014, gapSize: 0.011 };

export function Briefcase({ ref, mobile }: { ref?: Ref<BriefcaseHandle>; mobile: boolean }) {
  const { W, D, bodyH, lidH, wall, R, bevel } = CASE;
  const mats = useCaseMaterials(mobile);
  const root = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const latchL = useRef<THREE.Group>(null);
  const latchR = useRef<THREE.Group>(null);

  // hollow body: rounded rect with a rounded hole, extruded upwards with a small bevel
  const bodyGeo = useMemo(() => {
    const outer = roundedRect(W - 2 * bevel, D - 2 * bevel, R - bevel);
    const innerW = W - 2 * wall;
    const innerD = D - 2 * wall;
    const hole = roundedRect(innerW + 2 * bevel, innerD + 2 * bevel, R - wall + 2 * bevel);
    outer.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(outer, {
      depth: bodyH - 2 * bevel,
      bevelEnabled: true,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 3,
      curveSegments: 10,
      steps: 1,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, bevel, 0);
    return g;
  }, [W, D, R, wall, bevel, bodyH]);

  const handleGeo = useMemo(() => {
    const y0 = bodyH - 0.012;
    const z0 = D / 2 + 0.012;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.17, y0, z0),
      new THREE.Vector3(-0.195, y0 - 0.05, z0 + 0.07),
      new THREE.Vector3(-0.16, y0 - 0.1, z0 + 0.105),
      new THREE.Vector3(0, y0 - 0.115, z0 + 0.115),
      new THREE.Vector3(0.16, y0 - 0.1, z0 + 0.105),
      new THREE.Vector3(0.195, y0 - 0.05, z0 + 0.07),
      new THREE.Vector3(0.17, y0, z0),
    ]);
    return new THREE.TubeGeometry(curve, mobile ? 40 : 72, 0.019, mobile ? 8 : 14, false);
  }, [bodyH, D, mobile]);

  const lidGeo = useMemo(() => new RoundedBoxGeometry(W, lidH, D, mobile ? 3 : 5, 0.04), [W, lidH, D, mobile]);

  useEffect(
    () => () => {
      bodyGeo.dispose();
      handleGeo.dispose();
      lidGeo.dispose();
    },
    [bodyGeo, handleGeo, lidGeo],
  );

  useImperativeHandle(
    ref,
    () => ({
      update(p, t) {
        if (!root.current || !spin.current || !lid.current) return;
        // arrival turn: 3/4 view → almost frontal, with a slow idle sway before it opens
        const turn = easeInOutSine(seg(p, STORY.turn[0], STORY.turn[1]));
        const idle = (1 - seg(p, STORY.lid[0], STORY.lid[1])) * Math.sin(t * 0.6) * 0.035;
        spin.current.rotation.y = lerp(0.62, 0.02, turn) + idle;
        // lid: slow start, swings past and settles
        const lt = seg(p, STORY.lid[0], STORY.lid[1]);
        const su = lt * lt * (3 - 2 * lt);
        lid.current.rotation.x = -CASE.lidOpen * easeOutBack(su, 1.0);
        // clasps pop just before the lid moves
        const ct = easeOutBack(seg(p, STORY.clasps[0], STORY.clasps[1]), 2.6);
        const latch = -1.35 * ct;
        if (latchL.current) latchL.current.rotation.x = latch;
        if (latchR.current) latchR.current.rotation.x = latch;
        // exit: drop below the frame while the sheets take over
        const ex = seg(p, STORY.caseExit[0], STORY.caseExit[1]);
        const e = ex * ex * (3 - 2 * ex);
        root.current.position.y = -e * 1.8;
        root.current.position.z = e * 0.6;
        const s = 1 - 0.25 * e;
        root.current.scale.setScalar(s);
        root.current.visible = ex < 1;
      },
    }),
    [],
  );

  const innerW = W - 2 * wall;
  const innerD = D - 2 * wall;
  const cornerOff = 0.0375 - 0.004;
  const bodyStitchTop = stitchLoop(W - wall, D - wall, R - wall / 2, bodyH + 0.0015);
  const bodyStitchLow = stitchLoop(W + 0.004, D + 0.004, R + 0.002, 0.035);
  const bodyStitchHigh = stitchLoop(W + 0.004, D + 0.004, R + 0.002, bodyH - 0.03);
  const lidStitchTop = stitchLoop(W - 0.06, D - 0.06, R - 0.02, lidH + 0.0015);
  const lidStitchPanel = stitchLoop(W - 0.2, D - 0.2, R, lidH + 0.0015);
  const lidStitchSide = stitchLoop(W + 0.004, D + 0.004, R + 0.002, 0.03);

  return (
    <group ref={root}>
      <group ref={spin}>
        {/* body */}
        <mesh geometry={bodyGeo} material={mats.leather} />
        {/* lining: back faces of a box fill the well */}
        <mesh material={mats.lining} position={[0, (CASE.floorY + bodyH + 0.002) / 2, 0]}>
          <boxGeometry args={[innerW - 0.004, bodyH + 0.002 - CASE.floorY, innerD - 0.004]} />
        </mesh>
        {/* stitched seams */}
        <Line points={bodyStitchTop} dashed {...STITCH} />
        <Line points={bodyStitchLow} dashed {...STITCH} />
        <Line points={bodyStitchHigh} dashed {...STITCH} />
        {/* corner protectors (bottom) */}
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <RoundedBox
              key={`c${sx}${sz}`}
              args={[0.075, 0.05, 0.075]}
              radius={0.016}
              smoothness={3}
              material={mats.gold}
              position={[sx * (W / 2 - cornerOff), 0.025, sz * (D / 2 - cornerOff)]}
            />
          )),
        )}
        {/* clasp bases + keyholes */}
        {[-0.3, 0.3].map((x) => (
          <group key={`b${x}`} position={[x, bodyH - 0.038, D / 2 + 0.006]}>
            <RoundedBox args={[0.11, 0.056, 0.014]} radius={0.007} smoothness={3} material={mats.gold} />
            <mesh material={mats.ink} position={[0, -0.006, 0.0075]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.006, 0.006, 0.003, 12]} />
            </mesh>
          </group>
        ))}
        {/* handle + rings */}
        <mesh geometry={handleGeo} material={mats.leatherDark} />
        {[-0.17, 0.17].map((x) => (
          <mesh key={`r${x}`} material={mats.gold} position={[x, bodyH - 0.012, D / 2 + 0.012]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.02, 0.006, 8, 20]} />
          </mesh>
        ))}
        {/* lid, hinged along the back edge */}
        <group ref={lid} position={[0, bodyH, -D / 2]}>
          <mesh geometry={lidGeo} material={mats.leather} position={[0, lidH / 2, D / 2]} />
          <Line points={lidStitchTop} dashed {...STITCH} position={[0, 0, D / 2]} />
          <Line points={lidStitchPanel} dashed {...STITCH} position={[0, 0, D / 2]} />
          <Line points={lidStitchSide} dashed {...STITCH} position={[0, 0, D / 2]} />
          {/* dark gasket (reads as the seam shadow when closed), lining plate + elastic strap on the underside */}
          <mesh material={mats.ink} position={[0, -0.002, D / 2]}>
            <boxGeometry args={[W - 0.03, 0.004, D - 0.03]} />
          </mesh>
          <mesh material={mats.liningFlat} position={[0, -0.0065, D / 2]}>
            <boxGeometry args={[W - 0.1, 0.005, D - 0.1]} />
          </mesh>
          <mesh material={mats.ink} position={[0, -0.0105, D / 2 + 0.14]}>
            <boxGeometry args={[W - 0.3, 0.004, 0.045]} />
          </mesh>
          {/* corner protectors (top) */}
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <RoundedBox
                key={`lc${sx}${sz}`}
                args={[0.075, 0.05, 0.075]}
                radius={0.016}
                smoothness={3}
                material={mats.gold}
                position={[sx * (W / 2 - cornerOff), lidH - 0.025, D / 2 + sz * (D / 2 - cornerOff)]}
              />
            )),
          )}
          {/* nameplate */}
          <group position={[0, lidH + 0.003, D * 0.66]}>
            <RoundedBox args={[0.34, 0.006, 0.1]} radius={0.003} smoothness={2} material={mats.gold} position={[0, -0.001, 0]} />
            <mesh position={[0, 0.0025, 0]} material={mats.plateFaces}>
              <boxGeometry args={[0.32, 0.004, 0.09]} />
            </mesh>
          </group>
          {/* latches hang from the lid's front edge and flip up when they pop */}
          {[-0.3, 0.3].map((x, i) => (
            <group key={`l${x}`} ref={i === 0 ? latchL : latchR} position={[x, 0.014, D + 0.008]}>
              <RoundedBox args={[0.086, 0.052, 0.016]} radius={0.006} smoothness={3} material={mats.gold} position={[0, -0.026, 0.009]} />
              <mesh material={mats.gold} position={[0, -0.04, 0.02]}>
                <boxGeometry args={[0.03, 0.012, 0.008]} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}
