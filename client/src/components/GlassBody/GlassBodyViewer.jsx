import { useState, useCallback, Suspense, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import * as THREE from "three";

import Heart from "./Heart";
import Lungs from "./Lungs";
import Liver from "./Liver";
import Kidney from "./Kidney";
import Stomach from "./Stomach";
import DigestiveSystem from "./DigestiveSystem";
import Brain from "./Brain";
import Eyes from "./Eyes";
import Skeleton from "./Skeleton";
import Muscles from "./Muscles";
import OrganInfoPanel from "./OrganInfoPanel";
import LayerToggle from "./LayerToggle";

// Floating energy particles around the body
function EnergyParticles() {
  const ref = useRef();
  const count = 300;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.6 + Math.random() * 1.5;
      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = Math.random() * 2.0;
      pos[i * 3 + 2] = Math.sin(angle) * r;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.03;
    // Gentle vertical float
    const t = state.clock.elapsedTime;
    const posArr = ref.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      posArr[i * 3 + 1] += Math.sin(t + i) * 0.0003;
      if (posArr[i * 3 + 1] > 2.2) posArr[i * 3 + 1] = 0;
      if (posArr[i * 3 + 1] < -0.1) posArr[i * 3 + 1] = 2.0;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={count} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.006}
        color="#4488ff"
        transparent
        opacity={0.5}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// Glowing circular platform
function Platform() {
  return (
    <group position={[0, 0.01, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 1.2, 64]} />
        <meshStandardMaterial
          color="#0a1628"
          emissive="#112244"
          emissiveIntensity={0.3}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Outer ring glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[1.15, 1.22, 64]} />
        <meshStandardMaterial
          color="#2255aa"
          emissive="#2255aa"
          emissiveIntensity={1.5}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Grid */}
      <gridHelper args={[3, 40, "#0a1a33", "#0d1f3c"]} position={[0, 0.001, 0]} />
    </group>
  );
}

// Spine energy line (vertical glowing line along spine)
function SpineGlow() {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.material.emissiveIntensity = 0.3 + Math.sin(state.clock.elapsedTime * 2) * 0.15;
  });
  return (
    <mesh ref={ref} position={[0, 1.0, -0.02]}>
      <cylinderGeometry args={[0.003, 0.003, 0.9, 6]} />
      <meshStandardMaterial
        color="#4488ff"
        emissive="#4488ff"
        emissiveIntensity={0.3}
        transparent
        opacity={0.25}
      />
    </mesh>
  );
}

// Default risk scores — connect to your backend API later
/*
 * ORGAN POSITIONS — calibrated to the normalized skeleton:
 * Skeleton normalized to 1.8 tall, centered at origin (Y: -0.9 to +0.9)
 * Head top ~0.9, neck ~0.7, chest ~0.4, belly ~0.1, hips ~-0.1, feet ~-0.9
 */
const ORGAN_POSITIONS = {
  brain:     [0, 0.82, 0.02],        // inside skull, slightly forward
  eyes:      [0, 0.76, 0.06],        // front of skull, eye-level
  heart:     [-0.04, 0.35, 0.04],  // left-center chest
  lungs:     [0, 0.38, 0],         // flanking heart
  liver:     [0.08, 0.18, 0.04],   // right side, below lungs
  stomach:   [-0.05, 0.12, 0.04],  // left side, below heart
  digestive: [0, 0.05, 0.05],      // center abdomen, below stomach
  kidneyL:   [-0.1, 0.1, -0.05],   // left posterior
  kidneyR:   [0.1, 0.1, -0.05],    // right posterior
};

const ORGAN_LABELS = {
  heart: "Heart",
  lungs: "Lungs",
  liver: "Liver",
  kidneyL: "Left Kidney",
  kidneyR: "Right Kidney",
  stomach: "Stomach",
  digestive: "Digestive System",
  brain: "Brain",
  eyes: "Eyes",
};

function OrganWrapper({ name, children, hoveredOrgan, onHover, onSelect }) {
  return (
    <group
      onClick={(e) => { e.stopPropagation(); onSelect(name); }}
      onPointerOver={(e) => { e.stopPropagation(); onHover(name); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { onHover(null); document.body.style.cursor = "default"; }}
    >
      {children}
    </group>
  );
}

function HumanBodyScene({ activeLayers, selectedOrgan, onSelectOrgan, hoveredOrgan, onHover, riskScores }) {
  return (
    <>
      {/* === LIGHTING === */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 5]} intensity={1} color="#ffffff" />
      <directionalLight position={[-3, 2, -3]} intensity={0.4} color="#8899cc" />
      <pointLight position={[0, 0.3, 1]} intensity={0.5} color="#4488ff" distance={4} />

      {/* === BODY === */}
      <group scale={1} position={[0, -0.1, 0]}>
        {/* === SKELETON === */}
        <Skeleton visible={activeLayers.skeleton} />

        {/* === MUSCLES === */}
        <Muscles visible={activeLayers.muscles} />

        {/* === ORGANS === */}
        {activeLayers.organs && (
          <>
            <OrganWrapper name="brain" hoveredOrgan={hoveredOrgan} onHover={onHover} onSelect={onSelectOrgan}>
              <Brain position={ORGAN_POSITIONS.brain} riskScore={riskScores.brain} hovered={hoveredOrgan === "brain" || selectedOrgan === "brain"} />
            </OrganWrapper>

            <OrganWrapper name="eyes" hoveredOrgan={hoveredOrgan} onHover={onHover} onSelect={onSelectOrgan}>
              <Eyes position={ORGAN_POSITIONS.eyes} riskScore={riskScores.eyes} hovered={hoveredOrgan === "eyes" || selectedOrgan === "eyes"} />
            </OrganWrapper>

            <OrganWrapper name="heart" hoveredOrgan={hoveredOrgan} onHover={onHover} onSelect={onSelectOrgan}>
              <Heart position={ORGAN_POSITIONS.heart} riskScore={riskScores.heart} hovered={hoveredOrgan === "heart" || selectedOrgan === "heart"} />
            </OrganWrapper>

            <OrganWrapper name="lungs" hoveredOrgan={hoveredOrgan} onHover={onHover} onSelect={onSelectOrgan}>
              <Lungs position={ORGAN_POSITIONS.lungs} riskScore={riskScores.lungs} hovered={hoveredOrgan === "lungs" || selectedOrgan === "lungs"} />
            </OrganWrapper>

            <OrganWrapper name="liver" hoveredOrgan={hoveredOrgan} onHover={onHover} onSelect={onSelectOrgan}>
              <Liver position={ORGAN_POSITIONS.liver} riskScore={riskScores.liver} hovered={hoveredOrgan === "liver" || selectedOrgan === "liver"} />
            </OrganWrapper>

            <OrganWrapper name="stomach" hoveredOrgan={hoveredOrgan} onHover={onHover} onSelect={onSelectOrgan}>
              <Stomach position={ORGAN_POSITIONS.stomach} riskScore={riskScores.stomach} hovered={hoveredOrgan === "stomach" || selectedOrgan === "stomach"} />
            </OrganWrapper>

            <OrganWrapper name="kidneyL" hoveredOrgan={hoveredOrgan} onHover={onHover} onSelect={onSelectOrgan}>
              <Kidney position={ORGAN_POSITIONS.kidneyL} riskScore={riskScores.kidneyL} hovered={hoveredOrgan === "kidneyL" || selectedOrgan === "kidneyL"} />
            </OrganWrapper>

            <OrganWrapper name="kidneyR" hoveredOrgan={hoveredOrgan} onHover={onHover} onSelect={onSelectOrgan}>
              <Kidney position={ORGAN_POSITIONS.kidneyR} riskScore={riskScores.kidneyR} hovered={hoveredOrgan === "kidneyR" || selectedOrgan === "kidneyR"} />
            </OrganWrapper>

            <OrganWrapper name="digestive" hoveredOrgan={hoveredOrgan} onHover={onHover} onSelect={onSelectOrgan}>
              <DigestiveSystem position={ORGAN_POSITIONS.digestive} riskScore={riskScores.digestive} hovered={hoveredOrgan === "digestive" || selectedOrgan === "digestive"} />
            </OrganWrapper>

            {/* Hover tooltip */}
            {hoveredOrgan && ORGAN_POSITIONS[hoveredOrgan] && (
              <Html
                position={[
                  ORGAN_POSITIONS[hoveredOrgan][0],
                  ORGAN_POSITIONS[hoveredOrgan][1] + 0.12,
                  ORGAN_POSITIONS[hoveredOrgan][2],
                ]}
                center
                style={{ pointerEvents: "none" }}
              >
                <div style={{
                  background: "rgba(5,8,20,0.9)",
                  color: "#fff",
                  padding: "5px 12px",
                  borderRadius: "8px",
                  fontSize: "0.72rem",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  border: "1px solid rgba(68,136,255,0.35)",
                  backdropFilter: "blur(8px)",
                  letterSpacing: "0.5px",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
                }}>
                  {ORGAN_LABELS[hoveredOrgan]}
                </div>
              </Html>
            )}
          </>
        )}
      </group>

      {/* === CONTROLS === */}
      <OrbitControls
        enablePan={false}
        minDistance={2.2}
        maxDistance={6.5}
        target={[0, 0.05, 0]}
        autoRotate
        autoRotateSpeed={0.4}
        maxPolarAngle={Math.PI * 0.85}
        minPolarAngle={Math.PI * 0.15}
      />
    </>
  );
}

export default function GlassBodyViewer({ insights, selectedOrgan: controlled, onSelectOrgan }) {
  const [activeLayers, setActiveLayers] = useState({
    skeleton: true,
    muscles: false,
    organs: true,
  });
  // The page can drive the selection (organ list beside the canvas); otherwise it's local.
  const [ownSelection, setOwnSelection] = useState(null);
  const selectedOrgan = controlled !== undefined ? controlled : ownSelection;
  const setSelectedOrgan = onSelectOrgan || setOwnSelection;
  const [hoveredOrgan, setHoveredOrgan] = useState(null);
  const riskScores = insights?.riskScores || {};

  const toggleLayer = useCallback((key) => {
    setActiveLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return (
    <div className="gb-viewer">
      <Canvas
        camera={{ position: [0, 0.2, 3.5], fov: 40 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        style={{ background: "transparent" }}
        dpr={[1, 2]}
        onPointerMissed={() => setSelectedOrgan(null)}
      >
        <Suspense fallback={null}>
          <HumanBodyScene
            activeLayers={activeLayers}
            selectedOrgan={selectedOrgan}
            onSelectOrgan={setSelectedOrgan}
            hoveredOrgan={hoveredOrgan}
            onHover={setHoveredOrgan}
            riskScores={riskScores}
          />
        </Suspense>
      </Canvas>

      {/* Layer toggle UI */}
      <LayerToggle activeLayers={activeLayers} onToggle={toggleLayer} />

      {/* Organ info panel */}
      <OrganInfoPanel
        selectedOrgan={selectedOrgan}
        onClose={() => setSelectedOrgan(null)}
        insights={insights}
      />
    </div>
  );
}
