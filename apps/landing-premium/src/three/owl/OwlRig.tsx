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
  /** Roll / pitch of the whole owl (radians); the rig lags behind them (overlapping action) */
  bank?: number;
  pitch?: number;
  /** Head + eyes follow the pointer (presenter mode) */
  followPointer?: boolean;
  /** 0..1 "proud show": lifts and tilts the briefcase toward the camera; the lid peeks open around the middle */
  show?: number;
  /** Where the briefcase is. `auto` = hands/talons by flight amount; `hidden` = not rendered (the scene animates its own) */
  briefcase?: "auto" | "hidden";
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
  show?: number;
  briefcase?: "auto" | "hidden";
  flapHz?: number;
  /** 0..1 flap strength. Omitted = the owl alternates flapping bursts and glides on its own. */
  flapPower?: number;
  /** 0..1 landing flare: wings held high, slow deep strokes */
  flare?: number;
}

export interface OwlRigHandle {
  root: THREE.Group | null;
  /** World-space position of the talons' grip (where the briefcase handle hangs in flight) */
  gripWorld: (out: THREE.Vector3) => THREE.Vector3;
  /** World-space pose of the carried briefcase (to hand it over to the scene seamlessly) */
  caseWorld: (pos: THREE.Vector3, quat: THREE.Quaternion) => void;
}

const DEG = Math.PI / 180;
const LID_CLOSED = 0; // rotation.x of LidL/LidR when closed (the file's rest pose is half-open)
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _qh = new THREE.Quaternion();
const _eh = new THREE.Euler();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const damp = (a: number, b: number, k: number, dt: number) => THREE.MathUtils.damp(a, b, k, dt);
const clamp01 = (v: number) => THREE.MathUtils.clamp(v, 0, 1);
const ease = (t: number) => t * t * (3 - 2 * t);
const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
/** Asymmetric wing cycle: +1 wings up → fast downstroke → -1 → slow upstroke → +1 (zero velocity at both turns). */
const flapCycle = (u: number) => (u < 0.38 ? Math.cos((Math.PI * u) / 0.38) : -Math.cos((Math.PI * (u - 0.38)) / 0.62));
const fract = (v: number) => v - Math.floor(v);

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
      } else if (m.name.startsWith("Sclera") || m.name.startsWith("Iris") || m.name.startsWith("Pupil")) {
        const g = new THREE.MeshPhysicalMaterial({
          color: mat.color,
          roughness: m.name.startsWith("Sclera") ? 0.12 : 0.2,
          metalness: 0,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
          envMapIntensity: 1.2,
        });
        if (m.name.startsWith("Sclera")) g.emissive.set("#26262a");
        m.material = g;
      } else if (m.name.startsWith("Shine")) {
        const g = mat.clone();
        g.emissive.set("#ffffff");
        g.emissiveIntensity = 1.6;
        m.material = g;
        m.renderOrder = 3;
      } else if (mat.name.startsWith("V_")) {
        // flat vertex-colour painting (low-poly look): no procedural detail
        mat.vertexColors = true;
        mat.roughness = 0.85;
        mat.needsUpdate = true;
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
    flapHz: flapHzProp = 3.0,
    bank: bankProp = 0,
    pitch: pitchProp = 0,
    followPointer = true,
    show: showProp = 0,
    briefcase: briefcaseProp = "auto",
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
    const doc = node(owl, "Briefcase");
    const lid = node(owl, "Lid");
    const caseDoc = node(owl, "CaseDocument");
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
      head, wingL, wingR, feathersL, feathersR, talonL, talonR, doc, lid, caseDoc, body, eyeL, eyeR, lidL, lidR, tuftL, tuftR, glasses, glints,
      rest: {
        head: head.rotation.clone(),
        headPos: head.position.clone(),
        wingL: wingL.quaternion.clone(),
        wingR: wingR.quaternion.clone(),
        talonL: talonL.rotation.clone(),
        talonR: talonR.rotation.clone(),
        docPos: doc.position.clone(),
        docRot: doc.rotation.clone(),
        caseDocPos: caseDoc.position.clone(),
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
    bank: 0, pitch: 0,
    yaw: 0, hpitch: 0, eyeYaw: 0, eyePitch: 0,
    away: -1, nextAway: 5 + Math.random() * 6, awayYaw: 0, awayPitch: 0,
    blink: 0, nextBlink: 2 + Math.random() * 3, blinkT: -1, doubleBlink: false,
    glint: -1, nextGlint: 3 + Math.random() * 5, glintSide: 0,
    nudge: -1, nextNudge: 14 + Math.random() * 10,
    raise: 0,
    phase: Math.random(), power: 1, flare: 0,
    // briefcase pendulum (fore-aft, lateral) + world motion tracking
    swX: 0, swZ: 0, swVX: 0, swVZ: 0,
    wp: new THREE.Vector3(), wv: new THREE.Vector3(), wa: new THREE.Vector3(), wq: new THREE.Quaternion(), wInit: false,
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
    caseWorld: (pos: THREE.Vector3, quat: THREE.Quaternion) => {
      rig.doc.getWorldPosition(pos);
      rig.doc.getWorldQuaternion(quat);
    },
  }));

  const applyPose = (dt: number, staticPose: boolean) => {
    const s = st.current;
    const { rest } = rig;
    const d = drive?.current;
    const flight = d?.flight ?? flightProp;
    const bank = d?.bank ?? bankProp;
    const pitch = d?.pitch ?? pitchProp;
    const show = d?.show ?? showProp;
    const briefcase = d?.briefcase ?? briefcaseProp;
    const flapHz = d?.flapHz ?? flapHzProp;
    const flareT = d?.flare ?? 0;
    if (!staticPose) s.t += dt;
    const t = s.t;
    s.flight = staticPose ? flight : damp(s.flight, flight, 4, dt);
    const f = ease(clamp01(s.flight));
    const idle = 1 - f;
    // overlapping action: the body lags behind the requested bank / pitch
    s.bank = staticPose ? bank : damp(s.bank, bank, 2.6, dt);
    s.pitch = staticPose ? pitch : damp(s.pitch, pitch, 3.2, dt);
    s.flare = staticPose ? flareT : damp(s.flare, flareT, 4, dt);

    // ---- wing cycle: bursts of asymmetric strokes with glides in between (or driven power)
    let power = d?.flapPower;
    if (power === undefined) {
      const env = 0.5 + 0.5 * Math.sin(t * 0.5) + 0.25 * Math.sin(t * 1.7 + 1.3);
      power = THREE.MathUtils.smoothstep(env, 0.3, 0.7);
    }
    power = Math.max(power, s.flare);
    s.power = staticPose ? power : damp(s.power, power, 5, dt);
    const hz = flapHz * (1 - 0.35 * s.flare);
    if (!staticPose) s.phase += hz * s.power * dt;
    const u = fract(s.phase);
    const stroke = flapCycle(u); // +1 up, -1 down
    const strokeLag = flapCycle(fract(s.phase - 0.1));
    // body rises on the downstroke; lighter in a glide
    const flightBob = f * (-stroke * 0.05 * s.power + 0.015 * Math.sin(t * 1.3));

    // ---- head + eyes: pointer tracking with damping, occasional look-away (presenter)
    let ty = 0, tp = 0;
    if (!staticPose && idle > 0.5) {
      s.nextAway -= dt;
      if (s.nextAway <= 0 && s.away < 0) {
        s.away = 0;
        s.awayYaw = (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.2);
        s.awayPitch = (Math.random() - 0.5) * 0.16;
      }
      if (s.away >= 0) {
        s.away += dt;
        if (s.away > 1.8) {
          s.away = -1;
          s.nextAway = 7 + Math.random() * 8;
        }
      }
    }
    const awayK = s.away >= 0 ? Math.sin(Math.min(1, s.away / 1.8) * Math.PI) : 0;
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
      ty = THREE.MathUtils.clamp(dx * 1.1, -0.38, 0.38) * (1 - awayK);
      tp = THREE.MathUtils.clamp(dy * 0.8, -0.2, 0.28) * (1 - awayK);
    }
    ty += s.awayYaw * awayK + Math.sin(t * 0.35) * 0.04 * idle;
    tp += s.awayPitch * awayK + 0.3 * s.raise * idle;
    s.yaw = staticPose ? ty : damp(s.yaw, ty, 3.2, dt);
    s.hpitch = staticPose ? tp : damp(s.hpitch, tp, 3.2, dt);
    s.eyeYaw = staticPose ? ty : damp(s.eyeYaw, ty, 9, dt);
    s.eyePitch = staticPose ? tp : damp(s.eyePitch, tp, 9, dt);
    // in flight the head stays level while the body banks and bobs (stabilised head)
    rig.head.rotation.set(
      rest.head.x + s.hpitch + f * (-0.1 - 0.35 * s.pitch * 0.3 + 0.02 * stroke),
      rest.head.y + s.yaw,
      rest.head.z + Math.sin(t * 0.7) * 0.02 * idle - s.bank * 0.5 * f,
    );
    rig.head.position.y = rest.headPos.y + Math.sin(t * 1.4) * 0.008 * idle - flightBob * 0.5;
    const eyeK = 0.7;
    rig.eyeL.rotation.set((s.eyePitch - s.hpitch) * eyeK + s.hpitch * 0.3, (s.eyeYaw - s.yaw) * eyeK + s.yaw * 0.3, 0);
    rig.eyeR.rotation.copy(rig.eyeL.rotation);

    // ---- breathing (subtle)
    const breath = Math.sin(t * 1.25) * 0.008 * idle;
    rig.body.scale.set(rest.bodyScale.x * (1 + breath * 0.5), rest.bodyScale.y * (1 + breath), rest.bodyScale.z * (1 + breath * 0.5));

    // ---- blinks at natural random intervals
    if (!staticPose) {
      s.nextBlink -= dt;
      if (s.nextBlink <= 0 && s.blinkT < 0) {
        s.blinkT = 0;
        s.doubleBlink = Math.random() < 0.2;
      }
      if (s.blinkT >= 0) {
        s.blinkT += dt;
        const dur = 0.17;
        const cycle = s.doubleBlink ? 2 : 1;
        const tt = s.blinkT / dur;
        if (tt >= cycle) {
          s.blinkT = -1;
          s.blink = 0;
          s.nextBlink = 2.5 + Math.random() * 4.5;
        } else {
          s.blink = Math.sin((tt % 1) * Math.PI);
        }
      }
    }
    const lidX = THREE.MathUtils.lerp(rest.lidOpen, LID_CLOSED, ease(s.blink));
    rig.lidL.rotation.x = lidX;
    rig.lidR.rotation.x = lidX;

    // ---- glasses glint + (rare) push-up nudge
    if (!staticPose) {
      s.nextGlint -= dt;
      if (s.nextGlint <= 0 && s.glint < 0) {
        s.glint = 0;
        s.glintSide = Math.random() < 0.5 ? 0 : 1;
      }
      if (s.glint >= 0) {
        s.glint += dt;
        const p = s.glint / 0.6;
        if (p >= 1) {
          s.glint = -1;
          s.nextGlint = 4 + Math.random() * 6;
          (rig.glints[0].material as THREE.MeshBasicMaterial).opacity = 0;
        } else {
          const g = rig.glints[s.glintSide];
          g.position.x = THREE.MathUtils.lerp(-0.17, 0.17, ease(p));
          (g.material as THREE.MeshBasicMaterial).opacity = Math.sin(p * Math.PI) * 0.5;
        }
      }
      s.nextNudge -= dt;
      if (s.nextNudge <= 0 && s.nudge < 0 && idle > 0.9) s.nudge = 0;
      let nudgeY = 0;
      if (s.nudge >= 0) {
        s.nudge += dt;
        const p = s.nudge / 0.8;
        if (p >= 1) {
          s.nudge = -1;
          s.nextNudge = 16 + Math.random() * 12;
        } else nudgeY = Math.sin(ease(p) * Math.PI) * 0.026;
      }
      rig.glasses.position.y = rest.glassesPos.y + nudgeY;
      rig.glasses.rotation.x = nudgeY * 3;
    }

    // ---- tufts flutter (breeze idle, wind in flight)
    const flut = 0.03 * idle + (0.06 + 0.06 * s.power) * f;
    rig.tuftL.rotation.z = rest.tuftL.z + Math.sin(t * 2.6) * flut;
    rig.tuftR.rotation.z = rest.tuftR.z - Math.sin(t * 2.6 + 0.9) * flut;

    // ---- wings: rest (holding the paper) ⟷ flapping / gliding / flaring
    s.raise = staticPose ? show : damp(s.raise, show, 3, dt);
    const glide = 1 - s.power;
    const spreadBase = 88 * DEG + 6 * DEG * glide + 22 * DEG * s.flare;
    const amp = (34 * DEG + 14 * DEG * s.flare) * s.power + 3 * DEG * glide;
    const spread = spreadBase + amp * stroke + 2 * DEG * Math.sin(t * 1.6) * glide;
    const sweep = -12 * DEG + 5 * DEG * stroke * s.power - 6 * DEG * s.flare;
    for (const side of [1, -1] as const) {
      const wing = side > 0 ? rig.wingL : rig.wingR;
      const restQ = side > 0 ? rest.wingL : rest.wingR;
      _q2.setFromAxisAngle(X_AXIS, -0.55 * s.raise).multiply(restQ);
      _q.setFromAxisAngle(Z_AXIS, side * spread);
      _q3.setFromAxisAngle(Y_AXIS, side * sweep);
      _q.multiply(_q3);
      wing.quaternion.copy(_q2).slerp(_q, f);
      const feathers = side > 0 ? rig.feathersL : rig.feathersR;
      feathers.scale.setScalar(Math.max(0.001, f * 1.35));
      // feather tips lag the stroke (follow-through)
      feathers.rotation.z = -side * (0.2 * strokeLag * s.power + 0.05 * glide) * f;
    }

    // ---- talons: tucked back when flying, reaching down in the flare
    const talonX = 1.5 * f - 0.6 * s.flare * f;
    rig.talonL.rotation.x = rest.talonL.x + talonX;
    rig.talonR.rotation.x = rest.talonR.x + talonX;

    // ---- briefcase: held in front (proud show on scroll) or hanging by the handle from the talons
    const root = rootRef.current;
    if (briefcase === "hidden") {
      rig.doc.visible = false;
    } else {
      rig.doc.visible = true;
      const r = s.raise;
      // lid peeks open around the middle of the show, then closes again
      const peek = Math.sin(Math.PI * clamp01((r - 0.35) / 0.6)) * (1 - f);
      rig.lid.rotation.x = -1.25 * ease(peek);
      rig.caseDoc.position.y = rest.caseDocPos.y + 0.24 * ease(peek);
      if (f < 0.02) {
        rig.doc.position.set(rest.docPos.x, rest.docPos.y + 0.24 * r, rest.docPos.z + 0.10 * r);
        rig.doc.rotation.set(rest.docRot.x + 0.32 * r, 0, 0);
      } else if (root) {
        // world motion of the owl → inertial pendulum on the handle (small-angle, spring + damping)
        root.getWorldPosition(_v);
        root.getWorldQuaternion(s.wq);
        if (!s.wInit || staticPose) {
          s.wInit = true;
          s.wp.copy(_v);
          s.wv.set(0, 0, 0);
          s.wa.set(0, 0, 0);
        } else {
          _v2.copy(_v).sub(s.wp).divideScalar(Math.max(dt, 1e-3));
          s.wa.copy(_v2).sub(s.wv).divideScalar(Math.max(dt, 1e-3));
          s.wv.copy(_v2);
          s.wp.copy(_v);
        }
        // acceleration in the owl's heading frame (yaw only)
        const yawW = Math.atan2(2 * (s.wq.w * s.wq.y + s.wq.x * s.wq.z), 1 - 2 * (s.wq.y * s.wq.y + s.wq.x * s.wq.x));
        const ax = Math.cos(yawW) * s.wa.x - Math.sin(yawW) * s.wa.z; // lateral
        const az = Math.sin(yawW) * s.wa.x + Math.cos(yawW) * s.wa.z; // along the heading
        const L = 0.55, g = 9.8, c = 1.6;
        const drvX = THREE.MathUtils.clamp(-az / L * 0.06, -6, 6) + 0.6 * stroke * s.power; // fore-aft, plus the flap jerk
        const drvZ = THREE.MathUtils.clamp(ax / L * 0.06, -6, 6) - 3.0 * s.bank;
        if (!staticPose) {
          s.swVX += (-(g / L) * s.swX - c * s.swVX + drvX) * dt;
          s.swVZ += (-(g / L) * s.swZ - c * s.swVZ + drvZ) * dt;
          s.swX = THREE.MathUtils.clamp(s.swX + s.swVX * dt, -0.6, 0.6);
          s.swZ = THREE.MathUtils.clamp(s.swZ + s.swVZ * dt, -0.6, 0.6);
        }
        // hang vertically in world space (counter the body's pitch/bank), yawed with the heading, then swing
        _q.setFromAxisAngle(Y_AXIS, yawW);
        _q2.setFromAxisAngle(X_AXIS, s.swX).multiply(_q3.setFromAxisAngle(Z_AXIS, s.swZ));
        _q.multiply(_q2); // world orientation of the hanging case
        _q3.copy(s.wq).invert();
        _q3.multiply(_q); // → local (root) orientation
        // blend from the held pose during take-off
        _qh.setFromEuler(_eh.set(rest.docRot.x, 0, 0));
        rig.doc.quaternion.copy(_qh).slerp(_q3, f);
        // the handle top (case-local +0.43 up) sits at the talons' grip
        _v.set(0, 0.43, 0).applyQuaternion(rig.doc.quaternion);
        _v2.set(0, -0.02, 0.15).sub(_v);
        rig.doc.position.set(THREE.MathUtils.lerp(rest.docPos.x, _v2.x, f), THREE.MathUtils.lerp(rest.docPos.y + 0.24 * r, _v2.y, f), THREE.MathUtils.lerp(rest.docPos.z + 0.10 * r, _v2.z, f));
      }
    }

    // ---- whole-body bob / bank / pitch
    if (root) {
      root.rotation.set((rotation?.[0] ?? 0) + s.pitch * f, rotation?.[1] ?? 0, (rotation?.[2] ?? 0) + s.bank * f);
      root.position.set(position?.[0] ?? 0, (position?.[1] ?? 0) + flightBob + Math.sin(t * 1.1) * 0.012 * idle, position?.[2] ?? 0);
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
export { easeOutBack };
