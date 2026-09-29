import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from "react";
import * as THREE from "three";
import { drawSheet, fontsReady, makePaperBackTexture } from "./textures";
import { CASE } from "./Briefcase";
import { STORY, SHEETS, seg, lerp, easeOutCubic, easeInOutCubic, riseT, gridT, slotPx, type StageLayout } from "./story";

export interface SheetsHandle {
  update(p: number, t: number, camera: THREE.PerspectiveCamera): void;
}

export interface SheetData {
  name: string;
  description: string;
}

const VERT = /* glsl */ `
varying vec2 vUv;
varying float vShade;
void main() {
  vUv = uv;
  vec3 n = normalize(normalMatrix * normal);
  // paper facing the camera reads pure white (matches the HTML card); tilted or bent paper shades softly
  vShade = 0.64 + 0.36 * clamp(abs(n.z), 0.0, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FRAG = /* glsl */ `
uniform sampler2D map;
uniform float opacity;
varying vec2 vUv;
varying float vShade;
void main() {
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.02) discard;
  gl_FragColor = vec4(c.rgb * vShade, c.a * opacity);
  #include <colorspace_fragment>
}`;

function makePaperMaterial(map: THREE.Texture, side: THREE.Side) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, opacity: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    side,
    depthWrite: true,
  });
}

/** Camera-space distance of the final grid plane */
const GRID_Z = 2.2;

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qFan = new THREE.Quaternion();
const _qFlat = new THREE.Quaternion();
const _e = new THREE.Euler();

interface Pose {
  inCase: THREE.Vector3;
  inCaseYaw: number;
  inCaseScale: number;
  fan: THREE.Vector3;
  fanRot: THREE.Euler;
}

export function Sheets({
  ref,
  layout,
  data,
  icons,
}: {
  ref?: Ref<SheetsHandle>;
  layout: StageLayout;
  data: SheetData[];
  icons: (string | undefined)[];
}) {
  const { cardW, cardH, compact, mobile } = layout;
  const ratio = cardH / cardW;
  const groups = useRef<(THREE.Group | null)[]>([]);

  // one bendable plane per sheet (each is deformed on the CPU, so no sharing)
  const geos = useMemo(() => {
    const segX = mobile ? 6 : 10;
    const segY = mobile ? 4 : 6;
    return Array.from({ length: SHEETS }, () => {
      const g = new THREE.PlaneGeometry(1, ratio, segX, segY);
      g.userData.base = (g.attributes.position.array as Float32Array).slice();
      return g;
    });
  }, [ratio, mobile]);

  const textures = useMemo(() => {
    const S = Math.min(3, 1024 / cardW);
    return Array.from({ length: SHEETS }, () => {
      const c = document.createElement("canvas");
      c.width = Math.round(cardW * S);
      c.height = Math.round(cardH * S);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      return t;
    });
  }, [cardW, cardH]);
  const backTex = useMemo(() => makePaperBackTexture(cardW, cardH), [cardW, cardH]);

  const mats = useMemo(
    () => ({
      front: textures.map((t) => makePaperMaterial(t, THREE.FrontSide)),
      back: textures.map(() => makePaperMaterial(backTex, THREE.BackSide)),
    }),
    [textures, backTex],
  );

  // draw the sheet faces (waits for the brand fonts + the icon SVGs from the HTML cards)
  useEffect(() => {
    let alive = true;
    const paint = () => {
      textures.forEach((t, i) => {
        const d = data[i];
        if (!d) return;
        drawSheet(t.image as HTMLCanvasElement, {
          index: i,
          name: d.name,
          description: d.description,
          iconSvg: icons[i],
          cardW,
          cardH,
          compact,
        }).then(() => {
          if (alive) t.needsUpdate = true;
        });
        t.needsUpdate = true;
      });
    };
    paint();
    fontsReady().then(() => alive && paint());
    return () => {
      alive = false;
    };
  }, [textures, data, icons, cardW, cardH, compact]);

  useEffect(
    () => () => {
      geos.forEach((g) => g.dispose());
      textures.forEach((t) => t.dispose());
      backTex.dispose();
      mats.front.forEach((m) => m.dispose());
      mats.back.forEach((m) => m.dispose());
    },
    [geos, textures, backTex, mats],
  );

  // rest poses
  const poses = useMemo<Pose[]>(() => {
    const inCaseScale = Math.min(0.8, 0.56 / ratio);
    const spread = mobile ? 0.06 : 0.2;
    const seed = (i: number) => Math.sin(i * 12.9898) * 43758.5453 - Math.floor(Math.sin(i * 12.9898) * 43758.5453);
    return Array.from({ length: SHEETS }, (_, i) => {
      const k = i - 4;
      return {
        inCase: new THREE.Vector3((seed(i) - 0.5) * 0.02, CASE.floorY + 0.004 + (SHEETS - 1 - i) * 0.0035, (seed(i + 7) - 0.5) * 0.02),
        inCaseYaw: (seed(i + 3) - 0.5) * 0.08,
        fan: new THREE.Vector3(k * spread, (mobile ? 0.8 : 0.74) - Math.abs(k) * (mobile ? 0.02 : 0.03), 0.24 + i * 0.014),
        fanRot: new THREE.Euler(-0.1, k * 0.045, -k * (mobile ? 0.13 : 0.1)),
        inCaseScale,
      };
    });
  }, [ratio, mobile]);

  const fanScale = mobile ? 0.52 : 0.62;
  const apex = useMemo(() => new THREE.Vector3(0, mobile ? 0.95 : 0.9, -0.02), [mobile]);

  useImperativeHandle(
    ref,
    () => ({
      update(p, t, camera) {
        const fovHalf = THREE.MathUtils.degToRad(camera.fov / 2);
        const wpp = (2 * GRID_Z * Math.tan(fovHalf)) / layout.stageH;
        const gridScale = cardW * wpp;
        const fade = 1 - seg(p, STORY.fade[0], STORY.fade[1]);
        camera.getWorldDirection(_fwd);
        for (let i = 0; i < SHEETS; i++) {
          const g = groups.current[i];
          if (!g) continue;
          const pose = poses[i];
          const r = riseT(p, i);
          const gt = gridT(p, i);
          const rise = easeOutCubic(r);
          const grid = easeInOutCubic(gt);
          const floatW = rise * (1 - grid);

          // 1. flat in the case → fan (quadratic bezier through an apex above the case)
          const a = 1 - rise;
          _v2.set(pose.fan.x * 0.55, apex.y, apex.z + i * 0.01);
          _v.set(0, 0, 0)
            .addScaledVector(pose.inCase, a * a)
            .addScaledVector(_v2, 2 * a * rise)
            .addScaledVector(pose.fan, rise * rise);
          _v.y += Math.sin(t * 1.3 + i * 0.9) * 0.012 * floatW;
          _v.x += Math.sin(t * 0.7 + i * 1.7) * 0.006 * floatW;
          _qFlat.setFromEuler(_e.set(-Math.PI / 2, pose.inCaseYaw, 0));
          _e.copy(pose.fanRot);
          _e.z += Math.sin(t * 0.9 + i) * 0.025 * floatW;
          _qFan.setFromEuler(_e);
          _q.copy(_qFlat).slerp(_qFan, easeOutCubic(Math.min(1, r * 1.35)));
          let scale = lerp(pose.inCaseScale, fanScale, rise);

          // 2. fan → 3×3 grid in camera space (exactly where the HTML cards sit)
          if (gt > 0) {
            const slot = slotPx(layout, i);
            _v2.set(slot.x * wpp, -slot.y * wpp, -GRID_Z);
            camera.localToWorld(_v2);
            _v.lerp(_v2, grid);
            // small swoop towards the viewer mid-flight
            _v.addScaledVector(_fwd, -0.16 * Math.sin(Math.PI * grid));
            _q.slerp(camera.quaternion, grid);
            scale = lerp(scale, gridScale, grid);
          }
          g.position.copy(_v);
          g.quaternion.copy(_q);
          g.scale.setScalar(scale);

          // 3. paper bend: a little curl while it flies, dead flat when it becomes the card
          const curl = 0.055 * floatW + 0.02 * Math.sin(t * 1.7 + i) * floatW;
          bend(geos[i], curl, t + i);

          const op = fade;
          mats.front[i].uniforms.opacity.value = op;
          mats.back[i].uniforms.opacity.value = op;
          g.visible = op > 0.002 && r > 0.001;
        }
      },
    }),
    [poses, geos, mats, layout, cardW, fanScale, apex],
  );

  return (
    <group>
      {geos.map((geo, i) => (
        <group
          key={i}
          ref={(el) => {
            groups.current[i] = el;
          }}
          visible={false}
        >
          <mesh geometry={geo} material={mats.front[i]} renderOrder={10 + i} />
          <mesh geometry={geo} material={mats.back[i]} renderOrder={10 + i} />
        </group>
      ))}
    </group>
  );
}

function bend(geo: THREE.PlaneGeometry, curl: number, phase: number) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const base = geo.userData.base as Float32Array;
  const arr = pos.array as Float32Array;
  const last = geo.userData.lastCurl as number | undefined;
  if (Math.abs(curl) < 1e-4 && last !== undefined && Math.abs(last) < 1e-4) return;
  const ratio = geo.parameters.height;
  for (let i = 0; i < arr.length; i += 3) {
    const x = base[i];
    const y = base[i + 1];
    // cylindrical bend around the vertical axis + a soft travelling wave
    arr[i + 2] = curl * (0.17 - 2 * x * x) * 1.4 + curl * 0.3 * Math.sin((y / ratio) * Math.PI + phase * 0.8);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.userData.lastCurl = curl;
}
