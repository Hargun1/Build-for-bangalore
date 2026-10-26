import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/**
 * Loads a GLB, clones it, centers the geometry at origin,
 * and scales it so its largest dimension equals `targetSize`.
 */
export function useNormalizedGLTF(path, targetSize = 0.1, part = null) {
  const { scene } = useGLTF(path);
  const normalized = useMemo(() => {
    let clone = scene.clone(true);
    if (part) {
      scene.updateMatrixWorld(true);
      clone = new THREE.Group();
      // GLTFLoader removes dots and other reserved characters from node names.
      const meshName = THREE.PropertyBinding.sanitizeNodeName(part);
      scene.traverse((child) => {
        if (child.isMesh && child.name.includes(meshName)) {
          const mesh = new THREE.Mesh(child.geometry, child.material);
          mesh.applyMatrix4(child.matrixWorld);
          clone.add(mesh);
        }
      });
      if (!clone.children.length) throw new Error(`Anatomical mesh not found: ${part}`);
    }
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? targetSize / maxDim : 1;

    const wrapper = new THREE.Group();
    clone.position.sub(center);
    wrapper.add(clone);
    wrapper.scale.setScalar(scale);
    return wrapper;
  }, [scene, targetSize, part]);

  return normalized;
}
