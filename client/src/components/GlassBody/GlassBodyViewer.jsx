import { Component, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, useProgress } from "@react-three/drei";
import { Focus, Minus, Plus, RotateCcw, RotateCw } from "lucide-react";
import * as THREE from "three";
import { useNormalizedGLTF } from "./useNormalizedGLTF";
import AnatomicalShapes from "./AnatomicalShapes";
import { ANATOMY, organKeys, RISK_COLORS, riskTone } from "./anatomyLayout";
import "./GlassBody.css";

class ModelBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="gb-unavailable"><strong>3D view is unavailable</strong><p>The organ list and your results are still available.</p><button className="ui-btn" onClick={() => window.location.reload()}>Reload 3D view</button></div> : this.props.children;
  }
}

function Model({ file, size, part, color, selected, opacity = 1, passive = false }) {
  const model = useNormalizedGLTF(`/models/${file}`, size, part);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color, roughness: .65, metalness: 0, transparent: opacity < 1, opacity,
    depthWrite: opacity >= 1, emissive: selected ? color : "#000000", emissiveIntensity: selected ? .2 : 0,
  }), [color, selected, opacity]);
  useEffect(() => {
    model.traverse((child) => {
      if (child.isMesh) { child.material = material; if (passive) child.raycast = () => null; }
    });
    return () => material.dispose();
  }, [model, material, passive]);
  return <primitive object={model} dispose={null} />;
}

function Organ({ id, selected, onSelect, healthColors, score, dimmed, moving }) {
  const ref = useRef();
  const [hover, setHover] = useState(false);
  const organ = ANATOMY[id];
  const color = healthColors ? RISK_COLORS[riskTone(score)] : organ.color;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = moving && id === "heart" ? 1 + Math.max(0, Math.sin(clock.elapsedTime * 7.2)) ** 8 * .045 : 1;
    ref.current.scale.setScalar(s);
  });
  return <group position={organ.position}
    onClick={(e) => { e.stopPropagation(); onSelect(id); }}
    onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
    onPointerOut={() => setHover(false)}>
    <group ref={ref} rotation={organ.rotation || [0, 0, 0]} visible={!dimmed}>
      {organ.model ? <Model file={organ.model} part={organ.part} size={organ.size} color={color} selected={selected || hover} opacity={id === "lungs" ? .65 : 1} /> : <AnatomicalShapes kind={id} color={color} selected={selected || hover} />}
    </group>
    {hover && !dimmed && <Html position={[0, .08, .1]} center style={{ pointerEvents: "none" }}><span className="gb-tooltip">{organ.name}</span></Html>}
  </group>;
}

function CameraRig({ command, rotating, onRotate }) {
  const ref = useRef();
  const { camera } = useThree();
  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    const key = command.action;
    if (key === "in" || key === "out") {
      const offset = camera.position.clone().sub(controls.target);
      offset.multiplyScalar(key === "in" ? .8 : 1.25).clampLength(.55, 4.8);
      camera.position.copy(controls.target).add(offset);
    } else {
      const target = key === "focus" && ANATOMY[command.selected] ? new THREE.Vector3(...ANATOMY[command.selected].position) : new THREE.Vector3(0, .04, 0);
      controls.target.copy(target);
      camera.position.copy(target).add(new THREE.Vector3(0, 0, key === "back" ? -3.1 : key === "focus" ? .7 : 3.1));
      camera.up.set(0, 1, 0);
    }
    controls.update();
  }, [command, camera]);
  return <OrbitControls ref={ref} onStart={onRotate} makeDefault enablePan={false} minDistance={.55} maxDistance={4.8} target={[0,.04,0]} autoRotate={rotating} autoRotateSpeed={.65} minPolarAngle={.3} maxPolarAngle={Math.PI - .3} />;
}

function LoadingModel() {
  const { progress } = useProgress();
  return <Html center><div className="gb-model-loading"><span className="ui-spinner" /><span>Loading anatomy {Math.round(progress)}%</span></div></Html>;
}

export default function GlassBodyViewer({ body = "male", insights, selectedOrgan, onSelectOrgan }) {
  const [layers, setLayers] = useState({ skeleton: true, muscles: false, organs: true });
  const [healthColors, setHealthColors] = useState(false);
  const [isolate, setIsolate] = useState(false);
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const [rotating, setRotating] = useState(false);
  const [moving, setMoving] = useState(!reduced);
  const [command, setCommand] = useState({ action: "front", id: 0 });
  const [view, setView] = useState("front");
  const act = (action) => {
    setCommand((c) => ({ action, selected: selectedOrgan, id: c.id + 1 }));
    if (action === "front" || action === "back") { setView(action); setRotating(false); }
  };
  useEffect(() => { setIsolate(false); }, [body]);
  return <div className="gb-viewer">
    <div className="gb-toolbar">
      <div className="ui-tabs" aria-label="View direction"><button className={view === "front" ? "active" : ""} onClick={() => act("front")}>Front</button><button className={view === "back" ? "active" : ""} onClick={() => act("back")}>Back</button></div>
      <div className="gb-camera-tools">
        <button className="ui-btn ui-btn-ghost ui-icon-btn" onClick={() => act("in")} title="Zoom in" aria-label="Zoom in"><Plus /></button>
        <button className="ui-btn ui-btn-ghost ui-icon-btn" onClick={() => act("out")} title="Zoom out" aria-label="Zoom out"><Minus /></button>
        <button className="ui-btn ui-btn-ghost ui-icon-btn" onClick={() => act("focus")} disabled={!selectedOrgan} title="Focus selected organ" aria-label="Focus selected organ"><Focus /></button>
        <button className="ui-btn ui-btn-ghost ui-icon-btn" onClick={() => act("front")} title="Reset view" aria-label="Reset view"><RotateCcw /></button>
        <button className={`ui-btn ui-btn-ghost ui-icon-btn ${rotating ? "active" : ""}`} onClick={() => { setRotating(!rotating); setView("free"); }} title="Rotate model" aria-label="Rotate model" aria-pressed={rotating}><RotateCw /></button>
      </div>
    </div>
    <div className="gb-canvas">
      <ModelBoundary>
        <Canvas camera={{ position: [0,.04,3.1], fov: 38 }} dpr={[1,1.5]} gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} onPointerMissed={() => onSelectOrgan(null)} fallback={<div className="gb-unavailable">Your browser does not support 3D. The organ list is still available.</div>}>
          <ambientLight intensity={1.6} />
          <directionalLight position={[2,3,4]} intensity={2.3} color="#fff8ef" />
          <directionalLight position={[-3,1,-2]} intensity={1.5} color="#dcebe6" />
          <Suspense fallback={<LoadingModel />}>
            {layers.skeleton && <Model file="male_human_skeleton_-_zbrush_-_anatomy_study.glb" size={1.8} color="#b6c7bc" opacity={.18} passive />}
            {layers.muscles && <Model file="male_body_muscular_system_-_anatomy_study.glb" size={1.8} color="#b79184" opacity={.1} passive />}
            {layers.organs && organKeys(body).map((id) => <Organ key={id} id={id} selected={selectedOrgan === id} onSelect={onSelectOrgan} healthColors={healthColors} score={insights?.riskScores?.[id]} dimmed={isolate && selectedOrgan && id !== selectedOrgan} moving={moving} />)}
          </Suspense>
          <CameraRig command={command} rotating={rotating} onRotate={() => setView("free")} />
        </Canvas>
      </ModelBoundary>
      {view !== "free" && <><span className="gb-orientation gb-orientation-left">{view === "front" ? "R" : "L"}</span><span className="gb-orientation gb-orientation-right">{view === "front" ? "L" : "R"}</span></>}
    </div>
    <div className="gb-layer-controls">
      {Object.entries(layers).map(([key, value]) => <label className="ui-check" key={key}><input type="checkbox" checked={value} onChange={() => setLayers((l) => ({ ...l, [key]: !l[key] }))} />{key === "skeleton" ? "Skeleton" : key === "muscles" ? "Muscles" : "Organs"}</label>)}
      <label className="ui-check"><input type="checkbox" checked={healthColors} onChange={(e) => setHealthColors(e.target.checked)} />Health colors</label>
      <label className="ui-check"><input type="checkbox" checked={moving} onChange={(e) => setMoving(e.target.checked)} />Heartbeat</label>
      <label className="ui-check"><input type="checkbox" checked={isolate} disabled={!selectedOrgan} onChange={(e) => setIsolate(e.target.checked)} />Isolate</label>
    </div>
  </div>;
}
