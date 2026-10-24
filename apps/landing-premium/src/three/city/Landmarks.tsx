import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { DOOR, MALECON_Z, OFFICE, SEA_Z } from "./layout";
import { useGlow } from "./SkySea";
import { frontTexture, signTexture } from "./storefront";

/** Ground, avenues, seawall + lamp posts, the Malecón obelisk. */
export function Streets({ lamps = 26 }: { lamps?: number }) {
  const poleRef = useRef<THREE.InstancedMesh>(null);
  const bulbRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const p = poleRef.current, b = bulbRef.current;
    if (!p || !b) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < lamps; i++) {
      const x = -44 + (i / (lamps - 1)) * 88;
      o.position.set(x, 0, MALECON_Z + 2.3);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      p.setMatrixAt(i, o.matrix);
      o.position.set(x, 3.1, MALECON_Z + 2.3);
      o.updateMatrix();
      b.setMatrixAt(i, o.matrix);
    }
    p.instanceMatrix.needsUpdate = true;
    b.instanceMatrix.needsUpdate = true;
  }, [lamps]);
  const poleGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.05, 0.07, 3, 5);
    g.translate(0, 1.5, 0);
    return g;
  }, []);
  return (
    <group>
      {/* land */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 20]} receiveShadow>
        <planeGeometry args={[400, 130]} />
        <meshStandardMaterial color="#070d38" roughness={1} />
      </mesh>
      {/* seaside avenue */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, MALECON_Z]}>
        <planeGeometry args={[400, 4.2]} />
        <meshStandardMaterial color="#111b5e" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, MALECON_Z]}>
        <planeGeometry args={[400, 0.08]} />
        <meshBasicMaterial color="#00c853" toneMapped={false} transparent opacity={0.7} />
      </mesh>
      {/* seawall + promenade */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, MALECON_Z - 2.6]}>
        <planeGeometry args={[400, 1.4]} />
        <meshStandardMaterial color="#25336f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.3, SEA_Z + 0.2]}>
        <boxGeometry args={[400, 0.6, 0.4]} />
        <meshStandardMaterial color="#3a4a8a" roughness={0.8} />
      </mesh>
      {/* cross avenue towards the door */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[DOOR.x - 4.5, 0.02, 10]}>
        <planeGeometry args={[3, 40]} />
        <meshStandardMaterial color="#111b5e" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[OFFICE.x + 4.6, 0.02, 10]}>
        <planeGeometry args={[3, 40]} />
        <meshStandardMaterial color="#111b5e" roughness={0.95} />
      </mesh>
      {/* lamp posts */}
      <instancedMesh ref={poleRef} args={[poleGeo, undefined, lamps]} frustumCulled={false}>
        <meshStandardMaterial color="#2b3670" roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={bulbRef} args={[undefined, undefined, lamps]} frustumCulled={false}>
        <sphereGeometry args={[0.16, 8, 6]} />
        <meshBasicMaterial color="#ffe6a8" toneMapped={false} />
      </instancedMesh>
      {/* the Obelisco on the Malecón */}
      <group position={[-3, 0, MALECON_Z - 1.6]}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[2.2, 1, 2.2]} />
          <meshStandardMaterial color="#c9c2b0" roughness={0.8} />
        </mesh>
        <mesh position={[0, 7.5, 0]}>
          <cylinderGeometry args={[0.28, 0.6, 13, 4]} />
          <meshStandardMaterial color="#d8d2c2" roughness={0.7} emissive="#1f3dff" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, 14.35, 0]}>
          <coneGeometry args={[0.3, 0.8, 4]} />
          <meshBasicMaterial color="#ffe6a8" toneMapped={false} />
        </mesh>
        <pointLight position={[0, 2, 2]} intensity={12} color="#1f3dff" distance={12} />
      </group>
    </group>
  );
}

function label(text: string, bg: string, fg: string) {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 160;
  const ctx = c.getContext("2d")!;
  ctx.font = "700 46px Unbounded, 'Inter Tight', system-ui, sans-serif";
  const w = Math.min(600, ctx.measureText(text).width + 90);
  const x = (640 - w) / 2;
  const r = 44;
  const pill = (dx: number, dy: number, fill: string) => {
    ctx.beginPath();
    ctx.roundRect(x + dx, 30 + dy, w, 96, r);
    ctx.fillStyle = fill;
    ctx.fill();
  };
  pill(6, 6, "#0b0b0c");
  pill(0, 0, bg);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#0b0b0c";
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 320, 80);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A floating map pin with a neo-brutalist label. */
export function Pin({ position, color, text, bg, fg, pulse }: { position: [number, number, number]; color: string; text: string; bg: string; fg: string; pulse?: boolean }) {
  const g = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => label(text, bg, fg), [text, bg, fg]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (g.current) g.current.position.y = position[1] + Math.sin(t * 1.6) * 0.18;
    if (ring.current && pulse) {
      const s = 1 + ((t * 0.7) % 1) * 1.6;
      ring.current.scale.setScalar(s);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - ((t * 0.7) % 1));
    }
  });
  return (
    <group position={[position[0], 0, position[2]]}>
      <group ref={g} position={[0, position[1], 0]}>
        <mesh position={[0, 0.9, 0]}>
          <sphereGeometry args={[0.62, 20, 14]} />
          <meshStandardMaterial color={color} roughness={0.4} emissive={color} emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0, 0.9, 0.5]}>
          <sphereGeometry args={[0.22, 12, 8]} />
          <meshBasicMaterial color="#f3f0e8" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.15, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.5, 1.1, 16]} />
          <meshStandardMaterial color={color} roughness={0.4} emissive={color} emissiveIntensity={0.35} />
        </mesh>
        <sprite position={[0, 2.35, 0]} scale={[5.2, 1.3, 1]}>
          <spriteMaterial map={tex} transparent depthWrite={false} />
        </sprite>
      </group>
      {/* ground ring */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.9, 1.1, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Gurú's office in La Feria: paper-coloured block with a blue sign and a lit door. */
// Gurú's office in La Feria, modelled on the real storefront: blue walls, a white awning with the
// GURÚ SOLUCIONES sign, the dark door with the logo and the shop window with the services and the owl.
const SHOP_W = 3.4; // storefront opening (m), facing +z (the take-off camera)
const SHOP_H = SHOP_W * (768 / 1024);

export function Office() {
  const { x, z, w, d, h } = OFFICE;
  const sign = useMemo(signTexture, []);
  const front = useMemo(frontTexture, []);
  const owlPoster = useTexture("/img/mascot_1.webp");
  owlPoster.colorSpace = THREE.SRGBColorSpace;
  const awningY = SHOP_H + 0.32;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#2747c9" roughness={0.85} />
      </mesh>
      <mesh position={[0, h + 0.15, 0]}>
        <boxGeometry args={[w + 0.3, 0.3, d + 0.3]} />
        <meshStandardMaterial color="#0b0b0c" roughness={0.9} />
      </mesh>
      {/* door + shop window */}
      <mesh position={[0, SHOP_H / 2 + 0.05, d / 2 + 0.01]}>
        <planeGeometry args={[SHOP_W, SHOP_H]} />
        <meshStandardMaterial map={front} emissiveMap={front} emissive="#ffffff" emissiveIntensity={0.35} roughness={0.35} metalness={0.1} />
      </mesh>
      {/* the owl poster in the window */}
      <mesh position={[SHOP_W * 0.21, SHOP_H * 0.25 + 0.05, d / 2 + 0.02]}>
        <planeGeometry args={[0.95, 0.95]} />
        <meshStandardMaterial map={owlPoster} emissiveMap={owlPoster} emissive="#ffffff" emissiveIntensity={0.4} roughness={0.4} />
      </mesh>
      {/* white awning with the sign on its front */}
      <mesh position={[0, awningY, d / 2 + 0.6]} rotation={[0.08, 0, 0]}>
        <boxGeometry args={[w + 0.2, 0.55, 1.2]} />
        <meshStandardMaterial color="#e9ecf1" roughness={0.6} />
      </mesh>
      <mesh position={[0, awningY - 0.05, d / 2 + 1.21]} rotation={[0.08, 0, 0]}>
        <planeGeometry args={[w + 0.2, 0.55]} />
        <meshStandardMaterial map={sign} emissiveMap={sign} emissive="#ffffff" emissiveIntensity={0.55} roughness={0.5} />
      </mesh>
      {/* warm light under the awning, the shop's glow on the pavement */}
      <pointLight position={[0, awningY - 0.6, d / 2 + 1.6]} intensity={9} color="#ffe2b0" distance={7} />
      <pointLight position={[0, 2.5, -d / 2 - 2]} intensity={18} color="#1f3dff" distance={12} />
    </group>
  );
}

/** The client's home: a small house with a navy door, a mint-lit doorway and a doormat. */
export function DoorHouse({ delivered }: { delivered: React.RefObject<number> }) {
  const { x, z, w, d, h } = DOOR;
  const glow = useRef<THREE.Sprite>(null);
  const halo = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const k = delivered.current ?? 0;
    if (glow.current) (glow.current.material as THREE.SpriteMaterial).opacity = 0.25 + 0.75 * k;
    if (halo.current) {
      const s = 1 + 0.06 * Math.sin(clock.elapsedTime * 4);
      halo.current.scale.setScalar(k * s);
    }
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#e9e4d8" roughness={0.9} />
      </mesh>
      {/* roof */}
      <mesh position={[0, h + 0.7, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[w * 0.82, 1.4, 4]} />
        <meshStandardMaterial color="#1f3dff" roughness={0.7} flatShading />
      </mesh>
      {/* door (front = +z) */}
      <mesh position={[0, 1.15, d / 2 + 0.03]}>
        <boxGeometry args={[1.2, 2.3, 0.08]} />
        <meshStandardMaterial color="#0d1b8c" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.15, d / 2 + 0.08]}>
        <planeGeometry args={[1.3, 2.4]} />
        <meshBasicMaterial color="#00c853" toneMapped={false} transparent opacity={0.35} />
      </mesh>
      <mesh position={[0.42, 1.1, d / 2 + 0.1]}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshBasicMaterial color="#ffe6a8" toneMapped={false} />
      </mesh>
      {/* windows */}
      {[-1.15, 1.15].map((wx) => (
        <mesh key={wx} position={[wx, 2.1, d / 2 + 0.03]}>
          <planeGeometry args={[0.7, 0.7]} />
          <meshBasicMaterial color="#ffd58a" toneMapped={false} />
        </mesh>
      ))}
      {/* doormat */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, d / 2 + 1.0]}>
        <planeGeometry args={[1.5, 1.0]} />
        <meshStandardMaterial color="#3b2a1a" roughness={1} />
      </mesh>
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, d / 2 + 1.0]} scale={0}>
        <ringGeometry args={[0.95, 1.15, 40]} />
        <meshBasicMaterial color="#00c853" toneMapped={false} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <sprite ref={glow} position={[0, 1.2, d / 2 + 0.6]} scale={[5, 5, 1]}>
        <spriteMaterial map={useGlow()} color="#00c853" transparent opacity={0.25} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <pointLight position={[0, 1.6, d / 2 + 1.6]} intensity={14} color="#00c853" distance={10} />
    </group>
  );
}
