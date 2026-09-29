import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Center, ContactShadows, useGLTF } from "@react-three/drei";
import * as THREE from "three";

export interface ModelStageProps {
  url: string;
  /** Solid brand color painted over the model (the current site does the same) */
  color?: string;
  emissive?: string;
  /** Keep the model's own textures instead of painting it */
  keepMaterials?: boolean;
  scale?: number;
  /** Largest dimension, in scene units, the model is resized to (models come in very different sizes) */
  fit?: number;
  cameraZ?: number;
  spin?: number;
  shadow?: boolean;
}

const pointer = { x: 0, y: 0 };
let pointerBound = false;
function bindPointer() {
  if (pointerBound) return;
  pointerBound = true;
  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    },
    { passive: true },
  );
}

function Model({ url, color, emissive, keepMaterials, scale = 1, fit = 2.6, spin = 0.25, shadow }: ModelStageProps) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const { fitScale, floorY } = useMemo(() => {
    const size = new THREE.Box3().setFromObject(cloned).getSize(new THREE.Vector3());
    const s = (fit / (Math.max(size.x, size.y, size.z) || 1)) * scale;
    // the model is centered, so its base sits half its height below the origin
    return { fitScale: s, floorY: -(size.y * s) / 2 - 0.08 };
  }, [cloned, fit, scale]);
  const spinGroup = useRef<THREE.Group>(null);
  const tiltGroup = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (keepMaterials) return;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color ?? "#00c853"),
      emissive: new THREE.Color(emissive ?? "#00331a"),
      roughness: 0.35,
      metalness: 0.15,
    });
    cloned.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = mat;
        m.castShadow = true;
      }
    });
    return () => mat.dispose();
  }, [cloned, color, emissive, keepMaterials]);

  useFrame((state, delta) => {
    if (spinGroup.current) spinGroup.current.rotation.y += delta * (hover ? spin * 4 : spin);
    if (tiltGroup.current) {
      tiltGroup.current.rotation.x = THREE.MathUtils.damp(tiltGroup.current.rotation.x, -pointer.y * 0.15, 3, delta);
      tiltGroup.current.rotation.z = THREE.MathUtils.damp(tiltGroup.current.rotation.z, -pointer.x * 0.08, 3, delta);
      tiltGroup.current.position.y = Math.sin(state.clock.elapsedTime * 1.1) * 0.06;
    }
  });

  return (
    <>
    {shadow !== false && <ContactShadows position={[0, floorY, 0]} opacity={0.3} scale={5} blur={2.6} far={3} />}
    <group ref={tiltGroup}>
      <group ref={spinGroup} scale={fitScale} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        <Center>
          <primitive object={cloned} />
        </Center>
      </group>
    </group>
    </>
  );
}

// Renders only while visible; mounts the canvas shortly before it scrolls into view
export default function ModelStage(props: ModelStageProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    bindPointer();
    if (!wrap.current) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        if (e.isIntersecting) setNear(true);
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(wrap.current);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className="absolute inset-0">
      {near && (
        <Canvas
          frameloop={visible ? "always" : "never"}
          dpr={[1, 1.75]}
          camera={{ position: [0, 0.4, props.cameraZ ?? 5], fov: 35 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[3, 5, 4]} intensity={2.4} />
          <directionalLight position={[-4, 2, -3]} intensity={1.2} color="#1f3dff" />
          <pointLight position={[0, -2, 3]} intensity={0.8} color="#00c853" />
          <Suspense fallback={null}>
            <Model {...props} />
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
