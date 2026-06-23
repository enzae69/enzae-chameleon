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

  const b = geo.bounds;
  const fw = b.maxX - b.minX + 6;
  const fd = b.maxZ - b.minZ + 6;

  return (
    <group>
      {/* Safety floor so the player always has visible ground (fills any gaps). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[fw, fd]} />
        <meshStandardMaterial color="#33343a" roughness={1} metalness={0} />
      </mesh>
      <primitive
        object={model}
        scale={geo.scale}
        position={[geo.offsetX, geo.offsetY, geo.offsetZ]}
      />
    </group>
  );
}
