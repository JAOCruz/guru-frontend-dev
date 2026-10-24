import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { buildSkyline, rng } from "./layout";

const TONES = ["#0c1a63", "#10247c", "#0a1450", "#152b8f", "#0b1f5a", "#1a2a6e"].map((c) => new THREE.Color(c));

/** Window lights are painted by the shader from the instance's own size, so 1 draw call for the whole skyline. */
function makeMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85, metalness: 0.05, vertexColors: false });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWarm = { value: new THREE.Color("#ffd58a") };
    shader.uniforms.uMint = { value: new THREE.Color("#00c853") };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWin; varying vec3 vLocalN; varying vec2 vSeed;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n vWin = (instanceMatrix * vec4(position, 1.0)).xyz; vLocalN = normal; vSeed = instanceMatrix[3].xz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWin; varying vec3 vLocalN; varying vec2 vSeed; uniform vec3 uWarm; uniform vec3 uMint;
        float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          // windows on the vertical faces: cells of 0.9 (h) × 0.7 (w); some lit, warm or mint
          float side = abs(vLocalN.x) > 0.5 ? vWin.z : vWin.x;
          float isWall = step(0.5, abs(vLocalN.x) + abs(vLocalN.z));
          vec2 cell = vec2(floor(side / 0.7), floor((vWin.y - 0.35) / 0.9));
          vec2 f = vec2(fract(side / 0.7), fract((vWin.y - 0.35) / 0.9));
          float inWin = step(0.22, f.x) * step(f.x, 0.78) * step(0.25, f.y) * step(f.y, 0.75);
          float h = hash21(cell + vSeed * 0.37 + vec2(abs(vLocalN.x) * 7.0, 0.0));
          float lit = step(0.62, h) * inWin * isWall * step(0.9, vWin.y);
          vec3 c = mix(uWarm, uMint, step(0.93, h));
          totalEmissiveRadiance += c * lit * (0.55 + 0.45 * hash21(cell * 3.1 + vSeed));
          // faint roof-edge rim
          totalEmissiveRadiance += vec3(0.08, 0.16, 0.55) * (1.0 - isWall) * 0.35;
        }`,
      );
  };
  return m;
}

export default function Buildings({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const specs = useMemo(() => buildSkyline(count), [count]);
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  const mat = useMemo(makeMaterial, []);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const r = rng(11);
    specs.forEach((b, i) => {
      o.position.set(b.x, 0, b.z);
      o.scale.set(b.w, b.h, b.d);
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, TONES[Math.floor(b.tone * TONES.length)].clone().multiplyScalar(0.8 + r() * 0.4));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [specs]);

  return <instancedMesh ref={ref} args={[geo, mat, specs.length]} frustumCulled={false} />;
}
