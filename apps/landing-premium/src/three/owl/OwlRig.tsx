import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { pointer, bindPointer } from "./pointer";

export const OWL_URL = "/models/owl.glb";
useGLTF.preload(OWL_URL, false, true);

export interface OwlRigProps {
  /** 0 = presenter holding the document, 1 = flying (wings spread, document in the talons). Blended. */
  flight?: number;
  /** Flap frequency in cycles per second while flying */
  flapHz?: number;
  /** Roll / pitch of the whole owl (radians), e.g. banking along a route */
  bank?: number;
  pitch?: number;
  /** Head + eyes follow the pointer (presenter mode) */
  followPointer?: boolean;
  /** 0..1 lifts the document to read it; the head tilts down */
  docRaise?: number;
  /** Where the document is. `auto` = hands/talons by flight amount; `hidden` = not rendered */
  document?: "auto" | "hidden";
  /** false = one static pose (reduced motion) */
  animate?: boolean;
  scale?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  drive?: RefObject<OwlDrive>;
}

/** Per-frame steering without React re-renders (values here override the props of the same name). */
export interface OwlDrive {
  flight?: number;
  bank?: number;
  pitch?: number;
  docRaise?: number;
  document?: "auto" | "hidden";
  flapHz?: number;
}

export interface OwlRigHandle {
  root: THREE.Group | null;
  /** World-space position of the talons' grip (where the document hangs in flight) */
  gripWorld: (out: THREE.Vector3) => THREE.Vector3;
}

const DEG = Math.PI / 180;
const LID_CLOSED = 0; // rotation.x of LidL/LidR when closed (file rest pose is open)
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const smooth = (a: number, b: number, k: number, dt: number) => THREE.MathUtils.damp(a, b, k, dt);
const ease = (t: number) => t * t * (3 - 2 * t);

/** A cloned, material-tuned copy of the owl. Returned nodes are looked up once. */
export function useOwlClone() {
  const { scene } = useGLTF(OWL_URL, false, true);
  return useMemo(() => {
    const root = scene.clone(true);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = false;
      m.receiveShadow = false;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (!mat) return;
      if (m.name.startsWith("Lens")) {
        // glasses: real transparency, a touch of sky in the glass
        const g = mat.clone();
        g.transparent = true;
        g.opacity = 0.13;
        g.roughness = 0.05;
        g.metalness = 0.0;
        g.envMapIntensity = 0.35;
        g.depthWrite = false;
        g.side = THREE.DoubleSide;
        g.color.set("#9fc2ff");
        m.material = g;
        m.renderOrder = 2;
      } else if (m.name.startsWith("Sclera")) {
        const g = mat.clone();
        g.roughness = 0.2;
        g.emissive.set("#2a2a28");
        m.material = g;
      } else if (m.name.startsWith("Shine")) {
        const g = mat.clone();
        g.emissive.set("#ffffff");
        g.emissiveIntensity = 1.4;
        m.material = g;
        m.renderOrder = 3;
      } else if (m.name.startsWith("Paper")) {
        const g = mat.clone();
        g.side = THREE.DoubleSide;
        m.material = g;
      }
    });
    return root;
  }, [scene]);
}

function node(root: THREE.Object3D, name: string): THREE.Object3D {
  const n = root.getObjectByName(name);
  if (!n) {
    console.warn(`[owl] node ${name} missing`);
    return new THREE.Object3D();
  }
  return n;
}

const OwlRig = forwardRef<OwlRigHandle, OwlRigProps>(function OwlRig(
  {
    flight: flightProp = 0,
    flapHz: flapHzProp = 3.2,
    bank: bankProp = 0,
    pitch: pitchProp = 0,
    followPointer = true,
    docRaise: docRaiseProp = 0,
    document: documentProp = "auto",
    animate = true,
    scale = 1,
    position,
    rotation,
    drive,
  },
  ref,
) {
  const owl = useOwlClone();
  const rootRef = useRef<THREE.Group>(null);
  const { gl } = useThree();

  // ---- nodes + rest transforms (captured once from the file)
  const rig = useMemo(() => {
    const head = node(owl, "Head");
    const wingL = node(owl, "WingL");
    const wingR = node(owl, "WingR");
    const feathersL = node(owl, "FeathersL");
    const feathersR = node(owl, "FeathersR");
    const talonL = node(owl, "TalonL");
    const talonR = node(owl, "TalonR");
    const doc = node(owl, "Document");
    const body = node(owl, "Body");
    const eyeL = node(owl, "EyeL");
    const eyeR = node(owl, "EyeR");
    const lidL = node(owl, "LidL");
    const lidR = node(owl, "LidR");
    const tuftL = node(owl, "TuftL");
    const tuftR = node(owl, "TuftR");
    const glasses = node(owl, "Glasses");
    const lensL = node(owl, "LensL");
    const lensR = node(owl, "LensR");


    // glasses glint: a thin white streak that sweeps across each lens
    const glintGeo = new THREE.PlaneGeometry(0.05, 0.3);
    const glintMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const glints = [lensL, lensR].map((lens) => {
      const g = new THREE.Mesh(glintGeo, glintMat);
      g.position.set(0, 0, 0.03);
      g.rotation.z = -0.6;
      g.renderOrder = 4;
      lens.add(g);
      return g;
    });

    return {
      head, wingL, wingR, feathersL, feathersR, talonL, talonR, doc, body, eyeL, eyeR, lidL, lidR, tuftL, tuftR, glasses, glints,
      rest: {
        head: head.rotation.clone(),
        headPos: head.position.clone(),
        wingL: wingL.quaternion.clone(),
        wingR: wingR.quaternion.clone(),
        talonL: talonL.rotation.clone(),
        talonR: talonR.rotation.clone(),
        docPos: doc.position.clone(),
        docRot: doc.rotation.clone(),
        lidOpen: lidL.rotation.x,
        tuftL: tuftL.rotation.clone(),
        tuftR: tuftR.rotation.clone(),
        glassesPos: glasses.position.clone(),
        bodyScale: body.scale.clone(),
      },
    };
  }, [owl]);

  // ---- animation state (mutable, no re-renders)
  const st = useRef({
    t: Math.random() * 10,
    flight: drive?.current?.flight ?? flightProp,
    yaw: 0, pitch: 0, eyeYaw: 0, eyePitch: 0,
    blink: 0, nextBlink: 1.5 + Math.random() * 3, blinkT: -1, doubleBlink: false,
    glint: -1, nextGlint: 2 + Math.random() * 4, glintSide: 0,
    nudge: -1, nextNudge: 6 + Math.random() * 6,
    raise: 0,
    rectCheck: 0, cx: 0.5, cy: 0.5,
  });

  useEffect(() => {
    bindPointer();
  }, []);

  useImperativeHandle(ref, () => ({
    get root() {
      return rootRef.current;
    },
    gripWorld: (out: THREE.Vector3) => {
      out.set(0, -0.02, 0.15);
      return rootRef.current ? rootRef.current.localToWorld(out) : out;
    },
  }));

  const applyPose = (dt: number, staticPose: boolean) => {
    const s = st.current;
    const { rest } = rig;
    const d = drive?.current;
    const flight = d?.flight ?? flightProp;
    const bank = d?.bank ?? bankProp;
    const pitch = d?.pitch ?? pitchProp;
    const docRaise = d?.docRaise ?? docRaiseProp;
    const document = d?.document ?? documentProp;
    const flapHz = d?.flapHz ?? flapHzProp;
    if (!staticPose) s.t += dt;
    const t = s.t;
    s.flight = staticPose ? flight : smooth(s.flight, flight, 4, dt);
    const f = ease(THREE.MathUtils.clamp(s.flight, 0, 1));
    const idle = 1 - f;

    // ---- head + eyes follow the pointer (presenter) / look ahead (flight)
    let ty = 0, tp = 0;
    if (followPointer && pointer.active && idle > 0.05) {
      s.rectCheck -= dt;
      if (s.rectCheck <= 0) {
        s.rectCheck = 0.5;
        const r = gl.domElement.getBoundingClientRect();
        s.cx = r.left + r.width / 2;
        s.cy = r.top + r.height * 0.42;
      }
      const dx = (pointer.cx - s.cx) / window.innerWidth;
      const dy = (pointer.cy - s.cy) / window.innerHeight;
      ty = THREE.MathUtils.clamp(dx * 1.6, -0.55, 0.55);
      tp = THREE.MathUtils.clamp(dy * 1.2, -0.28, 0.4);
    }
    // idle sway + reading tilt
    ty += Math.sin(t * 0.45) * 0.06 * idle;
    tp += 0.32 * s.raise * idle;
    s.yaw = staticPose ? ty : smooth(s.yaw, ty, 5, dt);
    s.pitch = staticPose ? tp : smooth(s.pitch, tp, 5, dt);
    s.eyeYaw = staticPose ? ty : smooth(s.eyeYaw, ty, 12, dt);
    s.eyePitch = staticPose ? tp : smooth(s.eyePitch, tp, 12, dt);
    const flightBob = f * Math.sin(t * flapHz * Math.PI * 2 - 0.4);
    rig.head.rotation.set(rest.head.x + s.pitch + f * (-0.12 + 0.05 * flightBob), rest.head.y + s.yaw, rest.head.z + Math.sin(t * 0.7) * 0.03 * idle);
    rig.head.position.y = rest.headPos.y + Math.sin(t * 1.4) * 0.012 * idle;
    const eyeK = 0.7;
    rig.eyeL.rotation.set((s.eyePitch - s.pitch) * eyeK + s.pitch * 0.35, (s.eyeYaw - s.yaw) * eyeK + s.yaw * 0.35, 0);
    rig.eyeR.rotation.copy(rig.eyeL.rotation);

    // ---- breathing
    const breath = Math.sin(t * 1.4) * 0.014 * idle;
    rig.body.scale.set(rest.bodyScale.x * (1 + breath * 0.6), rest.bodyScale.y * (1 + breath), rest.bodyScale.z * (1 + breath * 0.6));

    // ---- blinks
    if (!staticPose) {
      s.nextBlink -= dt;
      if (s.nextBlink <= 0 && s.blinkT < 0) {
        s.blinkT = 0;
        s.doubleBlink = Math.random() < 0.25;
      }
      if (s.blinkT >= 0) {
        s.blinkT += dt;
        const d = 0.16;
        const cycle = s.doubleBlink ? 2 : 1;
        const tt = s.blinkT / d;
        if (tt >= cycle) {
          s.blinkT = -1;
          s.blink = 0;
          s.nextBlink = 2 + Math.random() * 4.5;
        } else {
          s.blink = Math.sin((tt % 1) * Math.PI);
        }
      }
    }
    const lidX = THREE.MathUtils.lerp(rest.lidOpen, LID_CLOSED, s.blink);
    rig.lidL.rotation.x = lidX;
    rig.lidR.rotation.x = lidX;
    rig.lidL.visible = rig.lidR.visible = s.blink > 0.03;

    // ---- glasses glint + push-up nudge
    if (!staticPose) {
      s.nextGlint -= dt;
      if (s.nextGlint <= 0 && s.glint < 0) {
        s.glint = 0;
        s.glintSide = Math.random() < 0.5 ? 0 : 1;
      }
      if (s.glint >= 0) {
        s.glint += dt;
        const p = s.glint / 0.55;
        if (p >= 1) {
          s.glint = -1;
          s.nextGlint = 3 + Math.random() * 5;
          (rig.glints[0].material as THREE.MeshBasicMaterial).opacity = 0;
        } else {
          const g = rig.glints[s.glintSide];
          g.position.x = THREE.MathUtils.lerp(-0.17, 0.17, p);
          (g.material as THREE.MeshBasicMaterial).opacity = Math.sin(p * Math.PI) * 0.55;
        }
      }
      s.nextNudge -= dt;
      if (s.nextNudge <= 0 && s.nudge < 0 && idle > 0.9) s.nudge = 0;
      let nudgeY = 0;
      if (s.nudge >= 0) {
        s.nudge += dt;
        const p = s.nudge / 0.7;
        if (p >= 1) {
          s.nudge = -1;
          s.nextNudge = 7 + Math.random() * 7;
        } else nudgeY = Math.sin(p * Math.PI) * 0.028;
      }
      rig.glasses.position.y = rest.glassesPos.y + nudgeY;
      rig.glasses.rotation.x = nudgeY * 3;
    }

    // ---- tufts flutter (breeze idle, wind in flight)
    const flut = 0.04 * idle + 0.12 * f;
    rig.tuftL.rotation.z = rest.tuftL.z + Math.sin(t * 3.1) * flut;
    rig.tuftR.rotation.z = rest.tuftR.z - Math.sin(t * 3.1 + 0.9) * flut;

    // ---- wings: rest (holding the paper) ⟷ flapping
    s.raise = staticPose ? docRaise : smooth(s.raise, docRaise, 4, dt);
    const flap = Math.sin(t * flapHz * Math.PI * 2);
    const spread = 88 * DEG + 38 * DEG * flap;
    const sweep = -12 * DEG + 6 * DEG * flap; // slight forward cup
    for (const side of [1, -1] as const) {
      const wing = side > 0 ? rig.wingL : rig.wingR;
      const restQ = side > 0 ? rest.wingL : rest.wingR;
      // presenter: arms lift a little with the document
      _q2.setFromAxisAngle(X_AXIS, -0.55 * s.raise).multiply(restQ);
      // flight pose
      _q.setFromAxisAngle(Z_AXIS, side * spread);
      _q3.setFromAxisAngle(Y_AXIS, side * sweep);
      _q.multiply(_q3);
      wing.quaternion.copy(_q2).slerp(_q, f);
      const feathers = side > 0 ? rig.feathersL : rig.feathersR;
      const fs = Math.max(0.001, f * 1.35);
      feathers.scale.setScalar(fs);
      feathers.rotation.z = -side * 0.22 * Math.sin(t * flapHz * Math.PI * 2 - 0.9) * f;
    }

    // ---- talons: tucked back when flying
    rig.talonL.rotation.x = rest.talonL.x + 1.35 * f;
    rig.talonR.rotation.x = rest.talonR.x + 1.35 * f;

    // ---- document: in the hands (raised on scroll) or hanging from the talons
    if (document === "hidden") {
      rig.doc.visible = false;
    } else {
      rig.doc.visible = true;
      const r = s.raise;
      const hx = rest.docPos.x, hy = rest.docPos.y + 0.34 * r, hz = rest.docPos.z + 0.08 * r;
      const hrx = rest.docRot.x - 0.5 * r;
      const swing = Math.sin(t * 2.2) * 0.06 * f;
      rig.doc.position.set(THREE.MathUtils.lerp(hx, 0, f), THREE.MathUtils.lerp(hy, -0.16, f), THREE.MathUtils.lerp(hz, 0.16, f));
      rig.doc.rotation.set(THREE.MathUtils.lerp(hrx, -Math.PI / 2 + 0.55, f), 0, swing);
    }

    // ---- whole-body bob / bank
    const root = rootRef.current;
    if (root) {
      root.rotation.set((rotation?.[0] ?? 0) + pitch * f, rotation?.[1] ?? 0, (rotation?.[2] ?? 0) + bank * f);
      root.position.set(position?.[0] ?? 0, (position?.[1] ?? 0) + 0.06 * flightBob + Math.sin(t * 1.1) * 0.015 * idle, position?.[2] ?? 0);
    }
  };

  useFrame((_, delta) => applyPose(Math.min(delta, 0.05), !animate));

  return (
    <group ref={rootRef} scale={scale} position={position} rotation={rotation}>
      <primitive object={owl} />
    </group>
  );
});

export default OwlRig;
