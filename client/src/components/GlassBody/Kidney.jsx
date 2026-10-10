import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useNormalizedGLTF } from "./useNormalizedGLTF";

export default function Kidney({ riskScore = null, onClick, hovered, ...props }) {
  const model = useNormalizedGLTF("/models/medicine_organ_-_the_human_kidney.glb", 0.06);

  const riskColor = useMemo(() => {
    if (riskScore == null) return new THREE.Color("#7dd3fc"); // no data yet: neutral blue, not "healthy" green
    if (riskScore > 0.7) return new THREE.Color("#ff2244");
    if (riskScore > 0.4) return new THREE.Color("#ffaa00");
    return new THREE.Color("#44ff88");
  }, [riskScore]);

  useEffect(() => {
    model.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshPhysicalMaterial({
          color: riskColor, emissive: riskColor,
          emissiveIntensity: 0.2 + (hovered ? 0.4 : 0),
          roughness: 0.3, metalness: 0.03,
          transparent: true, opacity: 0.88, clearcoat: 0.2,
        });
      }
    });
  }, [riskColor, hovered, model]);

  return (
    <group {...props} onClick={onClick}
      onPointerOver={(e) => e.stopPropagation()}
      onPointerOut={(e) => e.stopPropagation()}>
      <primitive object={model} />
    </group>
  );
}
