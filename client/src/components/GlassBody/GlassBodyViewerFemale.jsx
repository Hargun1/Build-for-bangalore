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

/* ── Uterus as simple 3D mesh ── */
function Uterus({ riskScore = null, hovered, ...props }) {
  const ref = useRef();
  const riskColor = useMemo(() => {
    if (riskScore == null) return new THREE.Color("#7dd3fc"); // no data yet: neutral blue, not "healthy" green
    if (riskScore > 0.7) return new THREE.Color("#ff2244");
    if (riskScore > 0.4) return new THREE.Color("#ffaa00");
    return new THREE.Color("#e879a8");
  }, [riskScore]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.scale.set(1 + Math.sin(t * 0.6) * 0.01, 1, 1 + Math.sin(t * 0.6) * 0.01);
  });

  return (
    <group ref={ref} {...props}>
      {/* Uterus body — upside-down pear shape */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.035, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
        <meshPhysicalMaterial
          color={riskColor} emissive={riskColor}
          emissiveIntensity={0.3 + (hovered ? 0.4 : 0)}
          roughness={0.3} metalness={0.05}
          transparent opacity={0.85} clearcoat={0.2}
        />
      </mesh>
      {/* Left fallopian tube */}
      <mesh position={[-0.04, 0.01, 0]} rotation={[0, 0, -0.5]}>
        <cylinderGeometry args={[0.004, 0.004, 0.05, 8]} />
        <meshPhysicalMaterial color={riskColor} emissive={riskColor} emissiveIntensity={0.2 + (hovered ? 0.3 : 0)} transparent opacity={0.8} />
      </mesh>
      {/* Right fallopian tube */}
      <mesh position={[0.04, 0.01, 0]} rotation={[0, 0, 0.5]}>
        <cylinderGeometry args={[0.004, 0.004, 0.05, 8]} />
        <meshPhysicalMaterial color={riskColor} emissive={riskColor} emissiveIntensity={0.2 + (hovered ? 0.3 : 0)} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

/* ── Ovary as glowing sphere ── */
function Ovary({ riskScore = 0.1, hovered, ...props }) {
  const ref = useRef();
  const riskColor = useMemo(() => {
    if (riskScore > 0.7) return new THREE.Color("#ff2244");
    if (riskScore > 0.4) return new THREE.Color("#ffaa00");
    return new THREE.Color("#d8a0e0");
  }, [riskScore]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const s = 1 + Math.sin(t * 1.5) * 0.02;
    ref.current.scale.setScalar(s);
  });

  return (
    <mesh ref={ref} {...props}>
      <sphereGeometry args={[0.018, 16, 16]} />
      <meshPhysicalMaterial
        color={riskColor} emissive={riskColor}
        emissiveIntensity={0.3 + (hovered ? 0.4 : 0)}
        roughness={0.25} metalness={0.05}
        transparent opacity={0.88} clearcoat={0.3}
      />
    </mesh>
  );
}

/* ── Floating energy particles ── */
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
      <pointsMaterial size={0.006} color="#c864ff" transparent opacity={0.5} sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}

/* ── Platform ── */
function Platform() {
  return (
    <group position={[0, 0.01, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 1.2, 64]} />
        <meshStandardMaterial color="#1a0828" emissive="#2a1244" emissiveIntensity={0.3} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[1.15, 1.22, 64]} />
        <meshStandardMaterial color="#8822cc" emissive="#8822cc" emissiveIntensity={1.5} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <gridHelper args={[3, 40, "#1a0a33", "#1d0f3c"]} position={[0, 0.001, 0]} />
    </group>
  );
}

/* ── Spine glow ── */
function SpineGlow() {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.material.emissiveIntensity = 0.3 + Math.sin(state.clock.elapsedTime * 2) * 0.15;
  });
  return (
    <mesh ref={ref} position={[0, 1.0, -0.02]}>
      <cylinderGeometry args={[0.003, 0.003, 0.9, 6]} />
      <meshStandardMaterial color="#c864ff" emissive="#c864ff" emissiveIntensity={0.3} transparent opacity={0.25} />
    </mesh>
  );
}

const ORGAN_POSITIONS = {
  brain:     [0, 0.82, 0.02],
  eyes:      [0, 0.76, 0.06],
  heart:     [-0.04, 0.35, 0.04],
  lungs:     [0, 0.38, 0],
  liver:     [0.08, 0.18, 0.04],
  stomach:   [-0.05, 0.12, 0.04],
  digestive: [0, 0.05, 0.05],
  kidneyL:   [-0.1, 0.1, -0.05],
  kidneyR:   [0.1, 0.1, -0.05],
  uterus:    [0, -0.05, 0.04],
  ovaryL:    [-0.06, -0.03, 0.04],
  ovaryR:    [0.06, -0.03, 0.04],
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
  uterus: "Uterus",
  ovaryL: "Left Ovary",
  ovaryR: "Right Ovary",
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

function FemaleBodyScene({ activeLayers, selectedOrgan, onSelectOrgan, hoveredOrgan, onHover, riskScores }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 5]} intensity={1} color="#ffffff" />
      <directionalLight position={[-3, 2, -3]} intensity={0.4} color="#cc99ee" />
      <pointLight position={[0, 0.3, 1]} intensity={0.5} color="#c864ff" distance={4} />

      <group scale={1} position={[0, -0.1, 0]}>
        <Skeleton visible={activeLayers.skeleton} />
        <Muscles visible={activeLayers.muscles} />

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

            <OrganWrapper name="digestive" hoveredOrgan={hoveredOrgan} onHover={onHover} onSelect={onSelectOrgan}>
              <DigestiveSystem position={ORGAN_POSITIONS.digestive} riskScore={riskScores.digestive} hovered={hoveredOrgan === "digestive" || selectedOrgan === "digestive"} />
            </OrganWrapper>

            <OrganWrapper name="kidneyL" hoveredOrgan={hoveredOrgan} onHover={onHover} onSelect={onSelectOrgan}>
              <Kidney position={ORGAN_POSITIONS.kidneyL} riskScore={riskScores.kidneyL} hovered={hoveredOrgan === "kidneyL" || selectedOrgan === "kidneyL"} />
            </OrganWrapper>

            <OrganWrapper name="kidneyR" hoveredOrgan={hoveredOrgan} onHover={onHover} onSelect={onSelectOrgan}>
              <Kidney position={ORGAN_POSITIONS.kidneyR} riskScore={riskScores.kidneyR} hovered={hoveredOrgan === "kidneyR" || selectedOrgan === "kidneyR"} />
            </OrganWrapper>

            {/* Female-specific organs */}
            <OrganWrapper name="uterus" hoveredOrgan={hoveredOrgan} onHover={onHover} onSelect={onSelectOrgan}>
              <Uterus position={ORGAN_POSITIONS.uterus} riskScore={riskScores.uterus} hovered={hoveredOrgan === "uterus" || selectedOrgan === "uterus"} />
            </OrganWrapper>

            <OrganWrapper name="ovaryL" hoveredOrgan={hoveredOrgan} onHover={onHover} onSelect={onSelectOrgan}>
              <Ovary position={ORGAN_POSITIONS.ovaryL} riskScore={riskScores.ovaryL} hovered={hoveredOrgan === "ovaryL" || selectedOrgan === "ovaryL"} />
            </OrganWrapper>

            <OrganWrapper name="ovaryR" hoveredOrgan={hoveredOrgan} onHover={onHover} onSelect={onSelectOrgan}>
              <Ovary position={ORGAN_POSITIONS.ovaryR} riskScore={riskScores.ovaryR} hovered={hoveredOrgan === "ovaryR" || selectedOrgan === "ovaryR"} />
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
                  border: "1px solid rgba(200,100,255,0.35)",
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

export default function GlassBodyViewerFemale({ insights, selectedOrgan: controlled, onSelectOrgan }) {
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
          <FemaleBodyScene
            activeLayers={activeLayers}
            selectedOrgan={selectedOrgan}
            onSelectOrgan={setSelectedOrgan}
            hoveredOrgan={hoveredOrgan}
            onHover={setHoveredOrgan}
            riskScores={riskScores}
          />
        </Suspense>
      </Canvas>

      <LayerToggle activeLayers={activeLayers} onToggle={toggleLayer} />

      <OrganInfoPanel
        selectedOrgan={selectedOrgan}
        onClose={() => setSelectedOrgan(null)}
        insights={insights}
      />
    </div>
  );
}
