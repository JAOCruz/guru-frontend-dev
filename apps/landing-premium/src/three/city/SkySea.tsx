import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SEA_Z, rng } from "./layout";

/** Gradient night dome in brand blues, a moon and a star field. */
export function Sky({ stars = 500 }: { stars?: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTop: { value: new THREE.Color("#02041a") },
          uMid: { value: new THREE.Color("#0b1466") },
          uHorizon: { value: new THREE.Color("#1f3dff") },
          uGlow: { value: new THREE.Color("#00c853") },
        },
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          varying vec3 vP; uniform vec3 uTop, uMid, uHorizon, uGlow;
          void main(){
            float h = normalize(vP).y;            // -1..1
            vec3 c = mix(uMid, uTop, smoothstep(0.05, 0.75, h));
            c = mix(uHorizon * 0.9, c, smoothstep(-0.02, 0.22, h));
            // a thin mint after-glow right at the horizon
            c += uGlow * 0.22 * exp(-abs(h - 0.015) * 45.0);
            c = mix(c, uMid * 0.55, smoothstep(0.0, -0.3, h));
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  );
  const starGeo = useMemo(() => {
    const r = rng(5);
    const pos = new Float32Array(stars * 3);
    for (let i = 0; i < stars; i++) {
      const a = r() * Math.PI * 2;
      const e = 0.08 + r() * 0.9;
      const R = 180;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * R;
      pos[i * 3 + 1] = Math.sin(e) * R;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * R;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [stars]);
  return (
    <group>
      <mesh material={mat} frustumCulled={false}>
        <sphereGeometry args={[200, 24, 16]} />
      </mesh>
      <points geometry={starGeo} frustumCulled={false}>
        <pointsMaterial color="#dfe8ff" size={1.1} sizeAttenuation transparent opacity={0.85} depthWrite={false} />
      </points>
      {/* moon + glow */}
      <mesh position={[-48, 46, -120]}>
        <sphereGeometry args={[5, 20, 14]} />
        <meshBasicMaterial color="#fff4cf" toneMapped={false} />
      </mesh>
      <sprite position={[-48, 46, -119]} scale={[34, 34, 1]}>
        <spriteMaterial map={useGlow()} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  );
}

let glowTex: THREE.CanvasTexture | null = null;
export function useGlow() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(255,244,207,0.9)");
  g.addColorStop(0.35, "rgba(255,244,207,0.25)");
  g.addColorStop(1, "rgba(255,244,207,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** The Caribbean at night: deep blue, moving swell highlights, foam at the seawall and a moon streak. */
export function Sea() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color("#061a5e") },
      uShallow: { value: new THREE.Color("#1438b8") },
      uFoam: { value: new THREE.Color("#9fd9ff") },
      uMoonX: { value: -48.0 },
    }),
    [],
  );
  useFrame((_, dt) => {
    if (mat.current) mat.current.uniforms.uTime.value += dt;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, SEA_Z - 90]} frustumCulled={false}>
      <planeGeometry args={[400, 180, 1, 1]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={`varying vec2 vW; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xz; gl_Position = projectionMatrix * viewMatrix * wp; }`}
        fragmentShader={`
          varying vec2 vW; uniform float uTime; uniform vec3 uDeep, uShallow, uFoam; uniform float uMoonX;
          void main(){
            float shore = ${SEA_Z.toFixed(1)} - vW.y;          // distance from the seawall, grows seaward
            float sw = sin(vW.x * 0.35 + vW.y * 0.9 + uTime * 1.1) * sin(vW.y * 0.55 - uTime * 0.7 + vW.x * 0.12);
            float sw2 = sin(vW.x * 1.3 - uTime * 1.6 + vW.y * 2.1);
            vec3 c = mix(uShallow, uDeep, smoothstep(0.0, 40.0, shore));
            c += uShallow * 0.35 * smoothstep(0.55, 1.0, sw) + uFoam * 0.08 * smoothstep(0.7, 1.0, sw2);
            // foam band lapping at the wall
            float foam = smoothstep(2.2, 0.0, shore) * (0.35 + 0.35 * sin(vW.x * 2.0 + uTime * 2.2));
            c = mix(c, uFoam, foam * 0.55);
            // moon streak
            float streak = exp(-pow((vW.x - uMoonX * 0.55) / 9.0, 2.0)) * smoothstep(0.0, 25.0, shore) * (0.5 + 0.5 * smoothstep(0.6, 1.0, sw2));
            c += vec3(1.0, 0.95, 0.8) * streak * 0.6;
            gl_FragColor = vec4(c, 1.0);
          }`}
      />
    </mesh>
  );
}
