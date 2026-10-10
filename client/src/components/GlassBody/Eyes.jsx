import { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useNormalizedGLTF } from "./useNormalizedGLTF";

export default function Eyes({ riskScore = null, onClick, hovered, ...props }) {
  const groupRef = useRef();
  const modelL = useNormalizedGLTF("/models/human_eye.glb", 0.04);
  const modelR = useNormalizedGLTF("/models/human_eye.glb", 0.04);

  const riskColor = useMemo(() => {
    if (riskScore == null) return new THREE.Color("#7dd3fc"); // no data yet: neutral blue, not "healthy" green
    if (riskScore > 0.7) return new THREE.Color("#ff2244");
    if (riskScore > 0.4) return new THREE.Color("#ffaa00");
    return new THREE.Color("#44ff88");
  }, [riskScore]);

  useEffect(() => {
    [modelL, modelR].forEach((m) => {
      m.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshPhysicalMaterial({
            color: riskColor, emissive: riskColor,
            emissiveIntensity: 0.15 + (hovered ? 0.25 : 0),
            roughness: 0.2, metalness: 0.05,
            transparent: true, opacity: 0.88, clearcoat: 0.5,
          });
        }
      });
    });
  }, [riskColor, hovered, modelL, modelR]);

  return (
    <group ref={groupRef} {...props} onClick={onClick}
      onPointerOver={(e) => e.stopPropagation()}
      onPointerOut={(e) => e.stopPropagation()}>
      <group position={[-0.05, 0, 0]}>
        <primitive object={modelL} />
      </group>
      <group position={[0.05, 0, 0]}>
        <primitive object={modelR} />
      </group>
    </group>
  );
}
