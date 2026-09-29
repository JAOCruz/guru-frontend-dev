import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { MotionValue } from "framer-motion";
import { Briefcase, type BriefcaseHandle } from "./Briefcase";
import { Sheets, type SheetsHandle, type SheetData } from "./Sheets";
import { easeInOutSine, type StageLayout } from "./story";

export interface BriefcaseSceneProps {
  /** raw 0→1 scroll progress of the pinned section */
  progress: MotionValue<number>;
  /** smoothed progress written back every frame (drives the HTML crossfade) */
  smooth: MotionValue<number>;
  layout: StageLayout;
  data: SheetData[];
  icons: (string | undefined)[];
  active: boolean;
}

/** Studio reflections without downloading an HDRI */
function Env() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

interface Key {
  p: number;
  pos: [number, number, number];
  look: [number, number, number];
}
const DESKTOP_KEYS: Key[] = [
  { p: 0.0, pos: [0.8, 0.58, 1.45], look: [0, 0.07, 0] },
  { p: 0.2, pos: [0.18, 0.66, 1.55], look: [0, 0.09, 0] },
  { p: 0.3, pos: [0.0, 1.22, 2.5], look: [0, 0.34, 0] },
  { p: 0.66, pos: [0.0, 1.0, 2.7], look: [0, 0.52, 0.1] },
  { p: 0.9, pos: [0.0, 0.85, 3.0], look: [0, 0.6, 0.1] },
];
const MOBILE_KEYS: Key[] = DESKTOP_KEYS.map((k) => ({
  p: k.p,
  look: k.look,
  pos: [k.look[0] + (k.pos[0] - k.look[0]) * 1.55, k.look[1] + (k.pos[1] - k.look[1]) * 1.55, k.look[2] + (k.pos[2] - k.look[2]) * 1.55],
}));

const pointer = { x: 0, y: 0 };
let pointerBound = false;
function bindPointer() {
  if (pointerBound || typeof window === "undefined") return;
  pointerBound = true;
  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    },
    { passive: true },
  );
}

function Rig({ progress, smooth, layout, data, icons }: Omit<BriefcaseSceneProps, "active">) {
  const caseRef = useRef<BriefcaseHandle>(null);
  const sheetsRef = useRef<SheetsHandle>(null);
  const stage = useRef<THREE.Group>(null);
  const smoothed = useRef(progress.get());
  const { setDpr, camera } = useThree();
  const keys = layout.mobile ? MOBILE_KEYS : DESKTOP_KEYS;
  const slow = useRef({ acc: 0, dropped: 0 });
  const tmp = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3() }), []);

  useEffect(() => {
    if (!layout.mobile) bindPointer();
  }, [layout.mobile]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const target = progress.get();
    // scroll → smoothed progress (a scrub, so quick flicks still feel like a film)
    smoothed.current = THREE.MathUtils.damp(smoothed.current, target, 9, dt);
    if (Math.abs(smoothed.current - target) < 0.0005) smoothed.current = target;
    const p = smoothed.current;
    smooth.set(p);
    const t = state.clock.elapsedTime;

    // camera along the keyframes
    let k = 0;
    while (k < keys.length - 2 && p > keys[k + 1].p) k++;
    const a = keys[k];
    const b = keys[k + 1];
    const u = easeInOutSine(THREE.MathUtils.clamp((p - a.p) / (b.p - a.p), 0, 1));
    tmp.pos.set(...a.pos).lerp(tmp.a.set(...b.pos), u);
    tmp.look.set(...a.look).lerp(tmp.b.set(...b.look), u);
    // mouse parallax on desktop
    tmp.pos.x += pointer.x * 0.12;
    tmp.pos.y += pointer.y * 0.06;
    camera.position.copy(tmp.pos);
    camera.lookAt(tmp.look);
    camera.updateMatrixWorld();

    caseRef.current?.update(p, t);
    sheetsRef.current?.update(p, t, camera as THREE.PerspectiveCamera);

    // adaptive quality: sustained slow frames → lower the pixel ratio once, then once more
    const s = slow.current;
    if (delta > 0.026) s.acc += delta;
    else s.acc = Math.max(0, s.acc - delta * 0.5);
    if (s.acc > 2 && s.dropped < 2) {
      s.dropped++;
      s.acc = 0;
      setDpr(s.dropped === 1 ? Math.min(1.25, state.viewport.dpr) : 1);
    }
  });

  return (
    <group ref={stage}>
      <Briefcase ref={caseRef} mobile={layout.mobile} />
      <Sheets ref={sheetsRef} layout={layout} data={data} icons={icons} />
    </group>
  );
}

export default function BriefcaseScene({ active, ...rest }: BriefcaseSceneProps) {
  const mobile = rest.layout.mobile;
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, mobile ? 1.25 : 1.75]}
      camera={{ fov: 34, near: 0.1, far: 30, position: [0.8, 0.58, 1.45] }}
      gl={{ antialias: !mobile, alpha: true, powerPreference: "high-performance", stencil: false }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Env />
      <hemisphereLight args={["#fff5e4", "#7d5a3d", 0.75]} />
      <directionalLight position={[2.5, 4, 3]} intensity={2.4} color="#fff3df" />
      <directionalLight position={[-3, 2.5, -2]} intensity={1.3} color="#dbe4ff" />
      <directionalLight position={[0, 1.5, 4]} intensity={0.55} />
      {!mobile && <ContactShadows position={[0, -0.002, 0]} opacity={0.5} scale={3.2} blur={2.4} far={0.9} resolution={512} color="#2b1a0e" />}
      {mobile && <ContactShadows position={[0, -0.002, 0]} opacity={0.4} scale={3} blur={2} far={0.7} resolution={256} color="#2b1a0e" />}
      <Rig {...rest} />
    </Canvas>
  );
}
