import { useMemo } from "react";
import * as THREE from "three";

function Tissue({ color, selected, opacity = 1 }) {
  return <meshStandardMaterial color={color} roughness={.65} metalness={0} emissive={selected ? color : "#000000"} emissiveIntensity={selected ? .2 : 0} transparent={opacity < 1} opacity={opacity} />;
}

function Ellipsoid({ scale, position, rotation, ...material }) {
  return <mesh scale={scale} position={position} rotation={rotation}><sphereGeometry args={[1, 32, 24]} /><Tissue {...material} /></mesh>;
}

function Tube({ points, radius = .009, ...material }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), [points]);
  return <mesh><tubeGeometry args={[curve, 64, radius, 12, false]} /><Tissue {...material} /></mesh>;
}

// Simplified educational meshes for organs not supplied as independent source assets.
export default function AnatomicalShapes({ kind, color, selected }) {
  const m = { color, selected };
  if (kind === "eyes") return <>{[-.032, .032].map((x) => <group key={x} position={[x, 0, 0]}><Ellipsoid scale={[.013,.013,.013]} color="#e0ded1" selected={selected} /><Ellipsoid scale={[.006,.006,.002]} position={[0,0,.012]} color="#638f8c" /><Ellipsoid scale={[.0025,.0025,.001]} position={[0,0,.014]} color="#16221e" /></group>)}</>;
  if (kind === "thyroid") return <><Ellipsoid {...m} position={[-.017,0,0]} scale={[.013,.026,.009]} rotation={[0,0,-.2]} /><Ellipsoid {...m} position={[.017,0,0]} scale={[.013,.026,.009]} rotation={[0,0,.2]} /><Ellipsoid {...m} scale={[.02,.006,.007]} position={[0,-.005,0]} /></>;
  if (kind === "stomach") return <><Ellipsoid {...m} scale={[.04,.063,.033]} rotation={[0,0,-.4]} /><Tube {...m} radius={.012} points={[[.018,.07,-.004],[.015,.045,0],[.02,.01,0]]} /><Tube {...m} radius={.016} points={[[.012,-.025,0],[-.014,-.052,0],[-.048,-.045,0],[-.06,-.025,-.01]]} /></>;
  if (kind === "spleen") return <Ellipsoid {...m} scale={[.025,.052,.021]} rotation={[0,0,-.3]} />;
  if (kind === "pancreas") return <><Tube {...m} radius={.012} points={[[-.082,-.012,0],[-.05,-.005,0],[0,0,0],[.055,.02,.005],[.082,.025,0]]} /><Ellipsoid {...m} scale={[.02,.026,.016]} position={[-.065,-.01,0]} /></>;
  if (kind === "gallbladder") return <><Ellipsoid {...m} scale={[.013,.03,.014]} rotation={[0,0,-.35]} /><Tube {...m} radius={.004} points={[[.008,.022,0],[.014,.042,-.006],[.027,.05,-.012]]} /></>;
  if (kind === "bladder") return <><Ellipsoid {...m} scale={[.037,.033,.026]} /><Tube {...m} radius={.005} points={[[0,-.024,0],[0,-.048,0]]} /></>;
  if (kind === "uterus") return <><Ellipsoid {...m} scale={[.027,.033,.017]} /><Tube {...m} radius={.009} points={[[-.06,.026,0],[-.035,.035,0],[0,.02,0],[.035,.035,0],[.06,.026,0]]} /><Tube {...m} radius={.009} points={[[0,-.015,0],[0,-.05,.005]]} /></>;
  if (kind === "ovaryL" || kind === "ovaryR") return <Ellipsoid {...m} scale={[.014,.009,.008]} />;
  if (kind === "digestive") {
    const coils = Array.from({ length: 48 }, (_, i) => {
      const t = i / 47;
      return [Math.sin(t * Math.PI * 10) * (.058 - .01 * t), .055 - .135 * t, Math.cos(t * Math.PI * 10) * .012];
    });
    return <><Tube {...m} radius={.012} points={coils} /><Tube color="#b88a7a" selected={selected} radius={.019} points={[[-.09,-.065,0],[-.1,-.02,0],[-.1,.07,0],[-.075,.095,0],[0,.083,.01],[.075,.095,0],[.1,.07,0],[.1,-.025,0],[.07,-.075,0],[.02,-.092,-.015],[0,-.12,-.02]]} /></>;
  }
  return null;
}
