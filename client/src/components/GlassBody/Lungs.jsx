import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useNormalizedGLTF } from "./useNormalizedGLTF";

export default function Lungs({ riskScore = null, onClick, hovered, ...props }) {
  const groupRef = useRef();
  const model = useNormalizedGLTF("/models/realistic_human_lungs.glb", 0.2);

  const riskColor = useMemo(() => {
    if (riskScore == null) return new THREE.Color("#7dd3fc"); // no data yet: neutral blue, not "healthy" green
    if (riskScore > 0.7) return new THREE.Color("#ff2244");
    if (riskScore > 0.4) return new THREE.Color("#ffaa00");
    return new THREE.Color("#44ff88");
  }, [riskScore]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const breath = 1 + Math.sin(t * 1.6) * 0.03;
    groupRef.current.scale.set(breath, 1, breath);
  });

  useEffect(() => {
    model.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshPhysicalMaterial({
          color: riskColor, emissive: riskColor,
          emissiveIntensity: 0.2 + (hovered ? 0.4 : 0),
          roughness: 0.4, metalness: 0.02,
          transparent: true, opacity: 0.78, clearcoat: 0.2,
        });
      }
    });
  }, [riskColor, hovered, model]);

  return (
    <group ref={groupRef} {...props} onClick={onClick}
      onPointerOver={(e) => e.stopPropagation()}
      onPointerOut={(e) => e.stopPropagation()}>
      <primitive object={model} />
    </group>
  );
}
