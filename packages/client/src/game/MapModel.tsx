import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { MapDef } from "@enzae/shared";

/**
 * Renders a GLB-based map (Backrooms / Sewer) with the placement baked into the
 * shared map data: uniform scale + a vertical offset so its floor sits at y=0.
 * Collision for these maps comes from the shared occupancy grid, not this mesh.
 */
export default function MapModel({ def }: { def: MapDef }) {
  const url = `${import.meta.env.BASE_URL}${def.glb}`;
  const { scene } = useGLTF(url);
  const geo = def.geo!;

  const model = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);

  return <primitive object={model} scale={geo.scale} position={[0, geo.offsetY, 0]} />;
}
