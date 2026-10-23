import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type { MotionValue } from "framer-motion";
import * as THREE from "three";
import OwlRig, { OWL_URL, type OwlDrive, type OwlRigHandle } from "../owl/OwlRig";
import Buildings from "./Buildings";
import Palms from "./Palms";
import Route from "./Route";
import { Sea, Sky } from "./SkySea";
import { DoorHouse, Office, Pin, Streets } from "./Landmarks";
import { DOOR, OFFICE, route } from "./layout";

interface Props {
  progress: MotionValue<number>;
  mobile: boolean;
  /** Reduced motion: jump to the state instead of easing towards it */
  instant: boolean;
}

// Timeline (section progress 0 → 1)
const TAKEOFF_END = 0.08;
const FLY_END = 0.85;
const DROP_START = 0.87;
const DROP_END = 0.94;
export const DELIVERED_AT = 0.93;

const easeInOut = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * THREE.MathUtils.clamp(t, 0, 1));
const clamp01 = (v: number) => THREE.MathUtils.clamp(v, 0, 1);

const UP = new THREE.Vector3(0, 1, 0);
const _p = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _side = new THREE.Vector3();
const _camT = new THREE.Vector3();
const _lookT = new THREE.Vector3();
const MAT_POS = new THREE.Vector3(DOOR.x, 0.47, DOOR.z + DOOR.d / 2 + 1.0); // case centre when standing on the mat
const _qTarget = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));

export default function DeliveryScene({ progress, mobile, instant }: Props) {
  const { camera, invalidate, scene } = useThree();
  const owlGroup = useRef<THREE.Group>(null);
  const owl = useRef<OwlRigHandle>(null);
  const drive = useRef<OwlDrive>({ flight: 0, bank: 0, pitch: 0, flapHz: 3.0, briefcase: "auto" });
  const routeT = useRef(0);
  const delivered = useRef(0);
  const look = useRef(new THREE.Vector3(OFFICE.x, 3, OFFICE.z));
  const camInit = useRef(false);
  const fallingDoc = useRef<THREE.Object3D>(null);
  const dropFrom = useRef(new THREE.Vector3());
  const dropQuat = useRef(new THREE.Quaternion());
  const caseLid = useRef<THREE.Object3D | null>(null);
  const caseSheet = useRef<THREE.Object3D | null>(null);
  const caseSheetY = useRef(0);

  const { scene: gltf } = useGLTF(OWL_URL, false, true);
  const docClone = useMemo(() => {
    const d = gltf.getObjectByName("Briefcase")?.clone(true) ?? new THREE.Group();
    d.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.MeshStandardMaterial)?.name?.startsWith("V_")) {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.vertexColors = true;
        mat.needsUpdate = true;
      }
    });
    d.visible = false;
    return d;
  }, [gltf]);
  // resolve the lid / sheet from the mounted clone (not inside useMemo: StrictMode runs the factory twice)
  const caseParts = (fd: THREE.Object3D) => {
    if (caseLid.current?.parent !== fd) {
      caseLid.current = fd.getObjectByName("Lid") ?? null;
      caseSheet.current = fd.getObjectByName("CaseDocument") ?? null;
      caseSheetY.current = caseSheet.current?.position.y ?? 0;
    }
  };

  useEffect(() => {
    scene.fog = new THREE.Fog("#0b1466", 45, 150);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  // reduced motion: render a few frames on demand so the loaded model settles into the final pose
  useEffect(() => {
    if (!instant) return;
    const id = window.setInterval(invalidate, 150);
    const stop = window.setTimeout(() => window.clearInterval(id), 4000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, [instant, invalidate]);

  const pSmooth = useRef(-1);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const target = instant ? 1 : clamp01(progress.get()); // reduced motion = the delivered end state
    // damped follow of the scroll so fast scrolling / stopping never jitters the owl
    if (pSmooth.current < 0 || instant) pSmooth.current = target;
    else pSmooth.current = THREE.MathUtils.damp(pSmooth.current, target, 6, dt);
    const p = pSmooth.current;
    const k = instant ? 1 : 1 - Math.exp(-3.2 * dt); // camera damping factor
    const d = drive.current;

    // ---- phases
    const takeoff = clamp01(p / TAKEOFF_END);
    const fly = easeInOut((p - TAKEOFF_END) / (FLY_END - TAKEOFF_END));
    const landing = clamp01((p - FLY_END) / (DROP_START - FLY_END));
    const drop = clamp01((p - DROP_START) / (DROP_END - DROP_START));
    routeT.current = fly;
    delivered.current = clamp01((p - DELIVERED_AT) / 0.04);

    // ---- owl along the route
    const t = Math.min(0.999, Math.max(0.001, fly));
    route.getPointAt(t, _p);
    route.getTangentAt(t, _tan).normalize();
    const yaw = Math.atan2(_tan.x, _tan.z);
    // bank from the turn rate (compare the heading a little ahead); the rig lags behind it
    route.getTangentAt(Math.min(0.999, t + 0.015), _p2).normalize();
    let dyaw = Math.atan2(_p2.x, _p2.z) - yaw;
    if (dyaw > Math.PI) dyaw -= Math.PI * 2;
    if (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const bank = THREE.MathUtils.clamp(-dyaw * 7, -0.45, 0.45) * (1 - landing);
    // anticipation: crouch, then push off; flare + settle when landing
    const crouch = takeoff < 0.45 ? Math.sin((takeoff / 0.45) * Math.PI) : 0;
    const push = takeoff >= 0.45 ? Math.sin(clamp01((takeoff - 0.45) / 0.55) * Math.PI) : 0;
    const flare = Math.sin(clamp01(landing * 1.25) * Math.PI) * 0.9 + landing * 0.1;
    const settle = landing > 0 ? Math.exp(-3.5 * landing) * Math.cos(6.5 * landing) : 0;
    const lean =
      (1.0 - Math.asin(THREE.MathUtils.clamp(_tan.y, -1, 1)) * 0.6) * (1 - landing) * easeInOut(clamp01(fly / 0.06)) +
      (0.2 - 0.35 * flare) * landing;

    // lands beside the case after letting go (wings fold, back to the standing pose)
    const aside = easeInOut(drop);
    d.flight = easeInOut(clamp01((takeoff - 0.4) / 0.6)) * (1 - aside);
    d.bank = bank;
    d.pitch = lean;
    d.flapHz = 3.0;
    d.flare = flare;
    // driven strokes on take-off and landing; the owl chooses bursts/glides on its own while cruising
    d.flapPower = takeoff < 1 ? 1 : landing > 0 ? 1 : fly > 0.97 ? 1 : undefined;
    d.briefcase = drop > 0 ? "hidden" : "auto";

    const g = owlGroup.current;
    if (g) {
      const hoverY = landing * (0.45 + 0.12 * Math.sin(performance.now() * 0.003)) + settle * 0.35 - crouch * 0.12 + push * 0.18;
      // after letting go, the owl comes down and lands beside the case
      const lx = DOOR.x + (mobile ? 1.5 : 2.4), ly = 0.02, lz = DOOR.z + (mobile ? 2.5 : 2.4); // in front of the facade
      g.position.set(
        THREE.MathUtils.lerp(_p.x, lx, aside),
        THREE.MathUtils.lerp(_p.y + hoverY, ly, aside) + Math.sin(aside * Math.PI) * 0.3,
        THREE.MathUtils.lerp(_p.z, lz, aside),
      );
      // squash on the crouch, stretch on the push
      g.scale.set(1 + crouch * 0.05 - push * 0.03, 1 - crouch * 0.09 + push * 0.06, 1 + crouch * 0.05 - push * 0.03);
      // faces the camera on the roof, turns into the route as it lifts off, faces the door when landing
      const flyYaw = THREE.MathUtils.lerp(0.2, yaw, easeInOut(clamp01(fly / 0.06)));
      const faceYaw = landing > 0 ? THREE.MathUtils.lerp(yaw, 0.35 - 0.25 * aside, easeInOut(landing)) : flyYaw;
      g.rotation.y = faceYaw;
    }

    // ---- the briefcase is set down on the mat: gentle descent, small bounce, then the lid opens and the sheet peeks
    const fd = fallingDoc.current;
    if (fd) {
      caseParts(fd);
      if (drop <= 0) {
        fd.visible = false;
        if (owl.current) owl.current.caseWorld(dropFrom.current, dropQuat.current);
        if (caseLid.current) caseLid.current.rotation.x = 0;
        if (caseSheet.current) caseSheet.current.position.y = caseSheetY.current;
      } else {
        fd.visible = true;
        const land = clamp01(drop / 0.6); // descent
        const eL = easeInOut(land);
        fd.position.lerpVectors(dropFrom.current, MAT_POS, eL);
        // small lob on the way and a soft bounce on touch-down
        fd.position.y += Math.sin(land * Math.PI) * 0.25 + (drop > 0.6 && drop < 0.8 ? Math.sin(((drop - 0.6) / 0.2) * Math.PI) * 0.05 : 0);
        fd.quaternion.copy(dropQuat.current).slerp(_qTarget, eL);
        const open = easeInOut(clamp01((drop - 0.62) / 0.38));
        if (caseLid.current) caseLid.current.rotation.x = -1.5 * open;
        if (caseSheet.current) caseSheet.current.position.y = caseSheetY.current + 0.26 * easeInOut(clamp01((drop - 0.75) / 0.25));
      }
    }

    // ---- camera
    const back = mobile ? 11.5 : 9.5, up = mobile ? 5.5 : 4.4, side = mobile ? 1.2 : 3.0;
    if (p < TAKEOFF_END + 0.02 && fly < 0.02) {
      // take-off: from the street, in front of the shop (like the photo of the real storefront), the owl on its roof
      _camT.set(OFFICE.x + 1.6, mobile ? 4.4 : 3.6, OFFICE.z + (mobile ? 12 : 9.5));
      _lookT.set(OFFICE.x, mobile ? 3.4 : 2.7, OFFICE.z);
    } else {
      // follow cam, blending into the door view during the final approach (before the flare starts)
      _side.crossVectors(_tan, UP).normalize();
      _camT.copy(_p).addScaledVector(_tan, -back).addScaledVector(UP, up).addScaledVector(_side, side);
      _lookT.copy(_p).addScaledVector(_tan, 4).addScaledVector(UP, mobile ? 1.8 : 0.4).addScaledVector(_side, mobile ? 0 : -1.5);
      const approach = easeInOut(clamp01((fly - 0.8) / 0.2));
      _p2.set(DOOR.x + (mobile ? 0.8 : 4.5), 5.4, DOOR.z + (mobile ? 13 : 10.5));
      _camT.lerp(_p2, approach);
      _p2.set(DOOR.x, 2.9 + (mobile ? 1.4 : 0.2), DOOR.z + 1.5);
      _lookT.lerp(_p2, approach);
      // dolly in on the mat while the case is set down, so the open lid and the sheet read
      const closeUp = easeInOut(drop);
      _p2.set(DOOR.x + (mobile ? 2.4 : 3.2), 3.2, DOOR.z + (mobile ? 10 : 7.2));
      _camT.lerp(_p2, closeUp);
      _p2.set(DOOR.x + (mobile ? 0.8 : 0.3), 1.5 + (mobile ? 0.9 : 0), DOOR.z + (mobile ? 2.2 : 1.6));
      _lookT.lerp(_p2, closeUp);
    }
    if (!camInit.current) {
      camInit.current = true;
      camera.position.copy(_camT);
      look.current.copy(_lookT);
    } else {
      camera.position.lerp(_camT, k);
      look.current.lerp(_lookT, k);
    }
    camera.lookAt(look.current);
  });

  return (
    <>
      <Sky stars={mobile ? 220 : 520} />
      <Sea />
      <Streets lamps={mobile ? 14 : 26} />
      <Buildings count={mobile ? 95 : 230} />
      <Palms count={mobile ? 10 : 24} />
      <Office />
      <DoorHouse delivered={delivered} />
      <Pin position={[OFFICE.x - 0.4, OFFICE.h + 3.0, OFFICE.z - 2.2]} color="#1f3dff" text="Gurú · La Feria" bg="#1f3dff" fg="#ffffff" />
      <Pin position={[DOOR.x, DOOR.h + 1.6, DOOR.z]} color="#00c853" text="Tu puerta" bg="#00c853" fg="#0b0b0c" pulse />
      <Route progress={routeT} />
      <group ref={owlGroup} position={[OFFICE.x, OFFICE.h, OFFICE.z]}>
        <OwlRig ref={owl} drive={drive} followPointer={false} animate={!instant} />
        <pointLight position={[1.5, 2.5, 3]} intensity={mobile ? 14 : 20} color="#fff0d8" distance={10} />
      </group>
      <primitive object={docClone} ref={fallingDoc} />
      {/* lights */}
      <hemisphereLight args={["#4b63ff", "#04061a", 0.75]} />
      <directionalLight position={[-40, 50, -60]} intensity={0.9} color="#b8c6ff" />
      <ambientLight intensity={0.2} color="#3350ff" />
    </>
  );
}
