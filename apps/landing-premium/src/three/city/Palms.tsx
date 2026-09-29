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
    const leaves: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.ConeGeometry(0.42, 2.6, 4, 1);
      leaf.scale(1, 1, 0.3);
      leaf.translate(0, 1.3, 0);
      leaf.rotateX(Math.PI / 2 + 0.7); // droop outward
      leaf.rotateY((i / 7) * Math.PI * 2);
      leaves.push(leaf);
    }
    const nut = new THREE.SphereGeometry(0.28, 6, 5);
    leaves.push(nut);
    return mergeGeometries(leaves, false)!;
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
        <meshStandardMaterial color="#0f6b3f" roughness={0.8} emissive="#00c853" emissiveIntensity={0.12} flatShading />
      </instancedMesh>
    </>
  );
}
