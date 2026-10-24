import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MALECON_Z, rng } from "./layout";

/** Low-poly palms along the seafront: instanced trunks + instanced 7-leaf crowns (2 draw calls). */
export default function Palms({ count }: { count: number }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);

  const trunkGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.1, 0.2, 1, 6, 1);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  const crownGeo = useMemo(() => {
    // each frond is a strip that rises a little then droops in a smooth arc, tapering to the tip
    const frond = (len: number, droop: number) => {
      const N = 9;
      const pos: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const z = t * len;
        const y = 0.45 * Math.sin(t * Math.PI * 0.5) - droop * t * t;
        const w = 0.34 * Math.sin(Math.PI * Math.pow(t, 0.6)) + 0.03;
        pos.push(-w, y, z, w, y, z);
        if (i < N) {
          const a = i * 2;
          idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) {
      const f = frond(2.4 + (i % 3) * 0.35, 1.0 + (i % 2) * 0.35);
      f.rotateX(-0.15 - (i % 2) * 0.2);
      f.rotateY((i / 9) * Math.PI * 2 + (i % 2) * 0.2);
      parts.push(f);
    }
    const nut = new THREE.SphereGeometry(0.3, 8, 6);
    nut.deleteAttribute("uv");
    parts.push(nut);
    return mergeGeometries(parts, false)!;
  }, []);

  const spots = useMemo(() => {
    const r = rng(23);
    const out: { x: number; z: number; h: number; rot: number }[] = [];
    for (let i = 0; i < count; i++) {
      const x = -44 + (i / Math.max(1, count - 1)) * 88 + (r() - 0.5) * 2.5;
      const z = MALECON_Z - 1.9 + (r() - 0.5) * 0.4; // seaside sidewalk
      out.push({ x, z, h: 3.2 + r() * 2.2, rot: r() * Math.PI * 2 });
    }
    return out;
  }, [count]);

  useLayoutEffect(() => {
    const t = trunkRef.current, c = crownRef.current;
    if (!t || !c) return;
    const o = new THREE.Object3D();
    spots.forEach((s, i) => {
      o.position.set(s.x, 0, s.z);
      o.scale.set(1, s.h, 1);
      o.rotation.set(0, 0, 0.06);
      o.updateMatrix();
      t.setMatrixAt(i, o.matrix);
      o.position.set(s.x + 0.15, s.h, s.z);
      o.scale.set(1, 1, 1);
      o.rotation.set(0, s.rot, 0);
      o.updateMatrix();
      c.setMatrixAt(i, o.matrix);
    });
    t.instanceMatrix.needsUpdate = true;
    c.instanceMatrix.needsUpdate = true;
  }, [spots]);

  return (
    <>
      <instancedMesh ref={trunkRef} args={[trunkGeo, undefined, spots.length]} frustumCulled={false}>
        <meshStandardMaterial color="#3d2a1a" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={crownRef} args={[crownGeo, undefined, spots.length]} frustumCulled={false}>
        <meshStandardMaterial color="#0f6b3f" roughness={0.8} emissive="#00c853" emissiveIntensity={0.12} side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  );
}
