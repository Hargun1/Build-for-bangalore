import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useNormalizedGLTF } from "./useNormalizedGLTF";

export default function Brain({ riskScore = null, onClick, hovered, ...props }) {
  const ref = useRef();
  const model = useNormalizedGLTF("/models/human_brain.glb", 0.16);

  const riskColor = useMemo(() => {
    if (riskScore == null) return new THREE.Color("#7dd3fc"); // no data yet: neutral blue, not "healthy" green
    if (riskScore > 0.7) return new THREE.Color("#ff2244");
    if (riskScore > 0.4) return new THREE.Color("#ffaa00");
    return new THREE.Color("#44ff88");
  }, [riskScore]);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.emissiveIntensity = 0.35 + Math.sin(state.clock.elapsedTime * 2.5) * 0.12 + (hovered ? 0.4 : 0);
      }
    });
  });

  useEffect(() => {
    model.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshPhysicalMaterial({
          color: riskColor, emissive: riskColor,
          emissiveIntensity: 0.35,
          roughness: 0.7, metalness: 0.02,
          transparent: true, opacity: 0.9, clearcoat: 0.1,
        });
      }
    });
  }, [riskColor, hovered, model]);

  return (
    <group ref={ref} {...props} onClick={onClick}
      onPointerOver={(e) => e.stopPropagation()}
      onPointerOut={(e) => e.stopPropagation()}>
      <primitive object={model} />
    </group>
  );
}
