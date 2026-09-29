import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import type { MotionValue } from "framer-motion";
import OwlRig from "./OwlRig";
import StageEnv from "./StageEnv";
import { useStageVisibility } from "./useStageVisibility";
import { dprRange, hasWebGL, prefersReducedMotion } from "./webgl";

interface OwlStageProps {
  /** 0..1 section progress: the owl proudly lifts and shows the briefcase (lid peek in the middle) */
  progress?: MotionValue<number>;
  /** Static image shown when WebGL is unavailable */
  fallbackSrc: string;
}

function Presenter({ progress, animate }: { progress?: MotionValue<number>; animate: boolean }) {
  const [raise, setRaise] = useState(0);
  const last = useRef(-1);
  useFrame(() => {
    if (!progress) return;
    const p = progress.get();
    const r = Math.max(0, Math.min(1, (p - 0.2) / 0.6));
    const q = Math.round(r * 40) / 40;
    if (q !== last.current) {
      last.current = q;
      setRaise(q);
    }
  });
  const debugFlight = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("owl") === "flight";
  if (debugFlight) return <OwlRig position={[0, -0.6, 0]} scale={0.9} rotation={[0, 0.6, 0]} flight={1} animate={animate} followPointer={false} />;
  return <OwlRig position={[0, -1.22, 0]} scale={1.02} show={raise} animate={animate} followPointer />;
}

/** The Gurú owl as a live presenter inside a stage; renders only while visible. */
export default function OwlStage({ progress, fallbackSrc }: OwlStageProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const { near, visible } = useStageVisibility(wrap);
  const [gl, setGl] = useState<boolean | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setGl(hasWebGL());
    setReduced(prefersReducedMotion());
  }, []);

  const showCanvas = gl === true && near;
  return (
    <div ref={wrap} className="absolute inset-0">
      {gl === false && <img src={fallbackSrc} alt="El Búho de Gurú Soluciones" className="h-full w-full object-cover" />}
      {showCanvas && (
        <Canvas
          frameloop={reduced ? "demand" : visible ? "always" : "never"}
          dpr={dprRange()}
          camera={{ position: [0, 0.15, 5.6], fov: 30 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.toneMapping = 3; // ACESFilmic
          }}
        >
          <StageEnv intensity={0.18} />
          <hemisphereLight args={["#cfdcff", "#120c24", 0.35]} />
          <directionalLight position={[3.5, 5, 4]} intensity={1.35} color="#fff1dc" />
          <directionalLight position={[-4, 1.5, 2]} intensity={0.6} color="#1f3dff" />
          <spotLight position={[-2.5, 3, -3]} intensity={14} color="#00c853" angle={0.6} penumbra={0.8} />
          <Suspense fallback={null}>
            <Presenter progress={progress} animate={!reduced} />
            <ContactShadows position={[0, -1.24, 0]} opacity={0.5} scale={5} blur={2.4} far={2.5} color="#02051a" />
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
