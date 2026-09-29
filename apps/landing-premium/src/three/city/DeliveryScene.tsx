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
const MAT_POS = new THREE.Vector3(DOOR.x, 0.07, DOOR.z + DOOR.d / 2 + 1.0);

export default function DeliveryScene({ progress, mobile, instant }: Props) {
  const { camera, invalidate, scene } = useThree();
  const owlGroup = useRef<THREE.Group>(null);
  const owl = useRef<OwlRigHandle>(null);
  const drive = useRef<OwlDrive>({ flight: 0, bank: 0, pitch: 0, flapHz: 3.2, document: "auto" });
  const routeT = useRef(0);
  const delivered = useRef(0);
  const look = useRef(new THREE.Vector3(OFFICE.x, 3, OFFICE.z));
  const camInit = useRef(false);
  const fallingDoc = useRef<THREE.Object3D>(null);
  const dropFrom = useRef(new THREE.Vector3());
  const dropRot = useRef(0);

  const { scene: gltf } = useGLTF(OWL_URL, false, true);
  const docClone = useMemo(() => {
    const d = gltf.getObjectByName("Document")?.clone(true) ?? new THREE.Group();
    d.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.name.startsWith("Paper")) (m.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    });
    d.visible = false;
    return d;
  }, [gltf]);

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

  useFrame((_, dt) => {
    const p = instant ? 1 : clamp01(progress.get()); // reduced motion = the delivered end state
    const k = instant ? 1 : 1 - Math.exp(-3.2 * Math.min(dt, 0.05)); // damping factor
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
    // bank from the turn rate (compare the heading a little ahead)
    route.getTangentAt(Math.min(0.999, t + 0.015), _p2).normalize();
    let dyaw = Math.atan2(_p2.x, _p2.z) - yaw;
    if (dyaw > Math.PI) dyaw -= Math.PI * 2;
    if (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const bank = THREE.MathUtils.clamp(-dyaw * 9, -0.55, 0.55) * (1 - landing);
    const lean = (1.0 - Math.asin(THREE.MathUtils.clamp(_tan.y, -1, 1)) * 0.6) * (1 - landing) * clamp01(fly / 0.05) + 0.25 * landing;

    d.flight = easeInOut(takeoff);
    d.bank = bank;
    d.pitch = lean;
    d.flapHz = 3.2 - 1.1 * landing;
    d.document = drop > 0 ? "hidden" : "auto";

    const g = owlGroup.current;
    if (g) {
      // hover a touch higher over the door while dropping, then settle
      const hoverY = landing * (0.4 + 0.15 * Math.sin(performance.now() * 0.004));
      g.position.set(_p.x, _p.y + hoverY, _p.z);
      // face the route while flying; face the camera (door front) when landing
      // faces the camera on the roof, turns into the route as it lifts off, faces the door when landing
      const flyYaw = THREE.MathUtils.lerp(0.2, yaw, easeInOut(clamp01(fly / 0.06)));
      const faceYaw = landing > 0 ? THREE.MathUtils.lerp(yaw, 0.35, easeInOut(landing)) : flyYaw;
      g.rotation.y = faceYaw;
    }

    // ---- the document falls from the talons onto the mat
    const fd = fallingDoc.current;
    if (fd) {
      if (drop <= 0) {
        fd.visible = false;
        if (owl.current) owl.current.gripWorld(dropFrom.current);
        dropRot.current = g ? g.rotation.y : 0;
      } else {
        fd.visible = true;
        const e = drop * drop; // gravity
        fd.position.lerpVectors(dropFrom.current, MAT_POS, e);
        fd.position.x += Math.sin(drop * 9) * 0.35 * (1 - drop);
        fd.position.z += Math.cos(drop * 7) * 0.2 * (1 - drop);
        fd.rotation.set(THREE.MathUtils.lerp(-0.6, -Math.PI / 2, drop), THREE.MathUtils.lerp(dropRot.current, 0.25, drop), Math.sin(drop * 6) * 0.5 * (1 - drop));
      }
    }

    // ---- camera
    const back = mobile ? 11.5 : 9.5, up = mobile ? 5.5 : 4.4, side = mobile ? 1.2 : 3.0;
    if (p < TAKEOFF_END + 0.02 && fly < 0.02) {
      _camT.set(OFFICE.x + 2.5, 6.6, OFFICE.z + (mobile ? 11 : 8.5));
      _lookT.set(OFFICE.x, 4.0 + (mobile ? 1.2 : 0), OFFICE.z);
    } else if (landing > 0) {
      _camT.set(DOOR.x + (mobile ? 0.8 : 4.5), 5.4, DOOR.z + (mobile ? 13 : 10.5));
      _lookT.set(DOOR.x, 2.9 + (mobile ? 1.4 : 0.2), DOOR.z + 1.5);
      _side.crossVectors(_tan, UP).normalize();
      _p2.copy(_p).addScaledVector(_tan, -back).addScaledVector(UP, up).addScaledVector(_side, side);
      _camT.lerp(_p2, 1 - easeInOut(landing));
    } else {
      _side.crossVectors(_tan, UP).normalize();
      _camT.copy(_p).addScaledVector(_tan, -back).addScaledVector(UP, up).addScaledVector(_side, side);
      _lookT.copy(_p).addScaledVector(_tan, 4).addScaledVector(UP, mobile ? 1.8 : 0.4).addScaledVector(_side, mobile ? 0 : -1.5);
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
