import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/** Soft studio reflections without downloading an HDRI (PMREM of three's RoomEnvironment). */
export default function StageEnv({ intensity = 0.5 }: { intensity?: number }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = tex;
    scene.environmentIntensity = intensity;
    pmrem.dispose();
    return () => {
      if (scene.environment === tex) scene.environment = null;
      tex.dispose();
    };
  }, [gl, scene, intensity]);
  return null;
}
