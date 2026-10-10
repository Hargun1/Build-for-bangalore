import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useNormalizedGLTF } from "./useNormalizedGLTF";

export default function Stomach({ riskScore = null, onClick, hovered, ...props }) {
  const ref = useRef();
  const model = useNormalizedGLTF("/models/digestive_system__human_anatomy.glb", 0.1);

  const riskColor = useMemo(() => {
    if (riskScore == null) return new THREE.Color("#7dd3fc"); // no data yet: neutral blue, not "healthy" green
    if (riskScore > 0.7) return new THREE.Color("#ff2244");
    if (riskScore > 0.4) return new THREE.Color("#ffaa00");
    return new THREE.Color("#44ff88");
  }, [riskScore]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 1.2) * 0.015;
    ref.current.scale.set(pulse, 1, pulse);
  });

  useEffect(() => {
    model.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshPhysicalMaterial({
          color: riskColor, emissive: riskColor,
          emissiveIntensity: 0.2 + (hovered ? 0.35 : 0),
          roughness: 0.35, metalness: 0.02,
          transparent: true, opacity: 0.82, clearcoat: 0.15,
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
