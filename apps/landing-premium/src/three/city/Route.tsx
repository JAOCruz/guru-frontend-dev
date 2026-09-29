import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { route } from "./layout";

const SEGMENTS = 160;

/** The glowing flight route: a faint planned line plus a bright part that grows behind the owl. */
export default function Route({ progress }: { progress: React.RefObject<number> }) {
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.TubeGeometry(route, SEGMENTS, 0.045, 6, false), []);
  const geoHalo = useMemo(() => new THREE.TubeGeometry(route, SEGMENTS, 0.18, 6, false), []);
  const geoPlan = useMemo(() => new THREE.TubeGeometry(route, SEGMENTS, 0.03, 4, false), []);
  const perSeg = useMemo(() => geo.index!.count / SEGMENTS, [geo]);
  const perSegHalo = useMemo(() => geoHalo.index!.count / SEGMENTS, [geoHalo]);

  useFrame(() => {
    const t = Math.max(0, Math.min(1, progress.current ?? 0));
    const n = Math.max(0, Math.floor((t - 0.012) * SEGMENTS));
    core.current?.geometry.setDrawRange(0, n * perSeg);
    halo.current?.geometry.setDrawRange(0, n * perSegHalo);
  });

  return (
    <group>
      <mesh geometry={geoPlan}>
        <meshBasicMaterial color="#00c853" transparent opacity={0.28} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={core} geometry={geo}>
        <meshBasicMaterial color="#6dffae" toneMapped={false} transparent opacity={0.85} />
      </mesh>
      <mesh ref={halo} geometry={geoHalo}>
        <meshBasicMaterial color="#00c853" transparent opacity={0.14} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}
