import { Suspense, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useMotionValue, type MotionValue } from "framer-motion";
import { MathUtils, type PerspectiveCamera } from "three";
import DeliveryScene from "./DeliveryScene";

// Dev-only page (?capture=desktop|mobile) that renders the delivery flight frame by frame with a
// fixed clock, so tools/delivery-video can turn it into the scroll-driven video.
declare global {
  interface Window { __capStep?: (p: number, time: number) => string; __capReady?: boolean }
}

// Framing offset (fraction of the frame) that moves the subject away from the page's text panel:
// full at the take-off, easing to `end` for the landing so the owl stays inside the frame.
export interface Shift { start: [number, number]; end: [number, number] }

function Driver({ progress, shift }: { progress: MotionValue<number>; shift: Shift }) {
  const advance = useThree((s) => s.advance);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    const frame = (p: number) => {
      const k = MathUtils.smoothstep(p, 0.55, 1);
      const x = MathUtils.lerp(shift.start[0], shift.end[0], k);
      const y = MathUtils.lerp(shift.start[1], shift.end[1], k);
      camera.setViewOffset(size.width, size.height, -x * size.width, -y * size.height, size.width, size.height);
    };
    window.__capStep = (p, time) => {
      progress.set(p);
      frame(p);
      advance(time);
      return gl.domElement.toDataURL("image/png");
    };
    window.__capReady = true;
    return () => camera.clearViewOffset();
  }, [advance, gl, progress, camera, size, shift]);
  return null;
}

export default function CaptureDelivery({ mobile, scale = 1, shift }: { mobile: boolean; scale?: number; shift: Shift }) {
  const progress = useMotionValue(0);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#060a2b" }}>
      <Canvas
        frameloop="never"
        dpr={scale}
        camera={{ fov: mobile ? 52 : 44, near: 0.3, far: 400, position: [-30, 5, 20] }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = 3; // ACESFilmic, as on the page
          gl.setClearColor("#060a2b");
        }}
      >
        <Suspense fallback={null}>
          <DeliveryScene progress={progress} mobile={mobile} instant={false} />
          <Driver progress={progress} shift={shift} />
        </Suspense>
      </Canvas>
    </div>
  );
}
