import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import type { MotionValue } from "framer-motion";
import { dprRange } from "../owl/webgl";
import DeliveryScene from "./DeliveryScene";

// The delivery stage's renderer, in its own chunk so three.js is not part of the first download
export default function DeliveryCanvas({ progress, mobile, reduced, visible }: { progress: MotionValue<number>; mobile: boolean; reduced: boolean; visible: boolean }) {
  return (
    <Canvas
      frameloop={reduced ? "demand" : visible ? "always" : "never"}
      dpr={dprRange()}
      camera={{ fov: mobile ? 52 : 44, near: 0.3, far: 400, position: [-30, 5, 20] }}
      gl={{ antialias: !mobile, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = 3; // ACESFilmic
        gl.setClearColor("#060a2b");
      }}
    >
      <Suspense fallback={null}>
        <DeliveryScene progress={progress} mobile={mobile} instant={reduced} />
      </Suspense>
    </Canvas>
  );
}
