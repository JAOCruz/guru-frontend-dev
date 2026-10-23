import { Suspense, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useMotionValue, type MotionValue } from "framer-motion";
import DeliveryScene from "./DeliveryScene";

// Dev-only page (?capture=desktop|mobile) that renders the delivery flight frame by frame with a
// fixed clock, so tools/delivery-video can turn it into the scroll-driven video.
declare global {
  interface Window { __capStep?: (p: number, time: number) => string; __capReady?: boolean }
}

function Driver({ progress }: { progress: MotionValue<number> }) {
  const advance = useThree((s) => s.advance);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    window.__capStep = (p, time) => {
      progress.set(p);
      advance(time);
      return gl.domElement.toDataURL("image/png");
    };
    window.__capReady = true;
  }, [advance, gl, progress]);
  return null;
}

export default function CaptureDelivery({ mobile }: { mobile: boolean }) {
  const progress = useMotionValue(0);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#060a2b" }}>
      <Canvas
        frameloop="never"
        dpr={1}
        camera={{ fov: mobile ? 52 : 44, near: 0.3, far: 400, position: [-30, 5, 20] }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = 3; // ACESFilmic, as on the page
          gl.setClearColor("#060a2b");
        }}
      >
        <Suspense fallback={null}>
          <DeliveryScene progress={progress} mobile={mobile} instant={false} />
          <Driver progress={progress} />
        </Suspense>
      </Canvas>
    </div>
  );
}
