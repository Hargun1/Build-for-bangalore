import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useNormalizedGLTF } from "./useNormalizedGLTF";

export default function Heart({ riskScore = null, onClick, hovered, ...props }) {
  const groupRef = useRef();
  const model = useNormalizedGLTF("/models/realistic_human_heart.glb", 0.12);

  const riskColor = useMemo(() => {
    if (riskScore == null) return new THREE.Color("#7dd3fc"); // no data yet: neutral blue, not "healthy" green
    if (riskScore > 0.7) return new THREE.Color("#ff2244");
    if (riskScore > 0.4) return new THREE.Color("#ffaa00");
    return new THREE.Color("#44ff88");
  }, [riskScore]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const phase = (t * 1.2) % 1;
    const lub = Math.exp(-30 * (phase - 0.0) ** 2) * 0.08;
    const dub = Math.exp(-30 * (phase - 0.18) ** 2) * 0.05;
    const beat = 1 + lub + dub;
    groupRef.current.scale.setScalar(beat);
  });

  useEffect(() => {
    model.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshPhysicalMaterial({
          color: riskColor, emissive: riskColor,
          emissiveIntensity: 0.4 + (hovered ? 0.3 : 0),
          roughness: 0.25, metalness: 0.05,
          transparent: true, opacity: 0.92, clearcoat: 0.3,
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
