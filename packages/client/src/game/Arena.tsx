import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  generateMap,
  generateBuildings,
  ARENA_SIZE,
  ARENA_HALF,
  WALL_THICKNESS,
} from "@enzae/shared";
import { PropMesh } from "./Prop";
import Building from "./Building";
import { registerCollider, unregisterCollider } from "./colliders";

const WALL_H = 4.5; // facility perimeter wall height

export default function Arena({ seed }: { seed: number }) {
  const objects = useMemo(() => generateMap(seed), [seed]);
  const buildings = useMemo(() => generateBuildings(seed), [seed]);
  const colliderRef = useRef<THREE.Group>(null);

  // Register perimeter walls + buildings so the camera pulls in behind them.
  useEffect(() => {
    const g = colliderRef.current;
    registerCollider(g);
    return () => unregisterCollider(g);
  }, []);

  const walls = [
    { x: 0, z: -ARENA_HALF, w: ARENA_SIZE + WALL_THICKNESS, d: WALL_THICKNESS },
    { x: 0, z: ARENA_HALF, w: ARENA_SIZE + WALL_THICKNESS, d: WALL_THICKNESS },
    { x: -ARENA_HALF, z: 0, w: WALL_THICKNESS, d: ARENA_SIZE },
    { x: ARENA_HALF, z: 0, w: WALL_THICKNESS, d: ARENA_SIZE },
  ];

  return (
    <group>
      {/* Outer concrete apron so the world doesn't visibly end. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#3c4248" roughness={1} />
      </mesh>

      {/* Lab tile floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ARENA_SIZE, ARENA_SIZE]} />
        <meshStandardMaterial color="#b9c2c8" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Tile grid lines */}
      <gridHelper
        args={[ARENA_SIZE, Math.round(ARENA_SIZE / 3), "#8c97a0", "#9aa4ac"]}
        position={[0, 0.012, 0]}
      />

      {/* Central spawn pad with a hazard ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]} receiveShadow>
        <circleGeometry args={[6, 56]} />
        <meshStandardMaterial color="#8d969d" roughness={0.8} metalness={0.1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0]}>
        <ringGeometry args={[5.4, 6, 56]} />
        <meshStandardMaterial color="#e0b020" roughness={0.7} />
      </mesh>

      {/* Facility perimeter walls (camera collider) */}
      <group ref={colliderRef}>
        {walls.map((w, i) => (
          <group key={i} position={[w.x, 0, w.z]}>
            <mesh position={[0, WALL_H / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w.w, WALL_H, w.d]} />
              <meshStandardMaterial color="#9aa4ac" roughness={0.7} metalness={0.2} />
            </mesh>
            {/* hazard stripe at the base */}
            <mesh position={[0, 0.45, 0]}>
              <boxGeometry args={[w.w + 0.02, 0.5, w.d + 0.02]} />
              <meshStandardMaterial color="#d9a21a" roughness={0.7} />
            </mesh>
            {/* top rail */}
            <mesh position={[0, WALL_H + 0.1, 0]}>
              <boxGeometry args={[w.w + 0.15, 0.2, w.d + 0.15]} />
              <meshStandardMaterial color="#5b656b" roughness={0.6} metalness={0.4} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Walk-in lab modules (each registers its own walls as colliders) */}
      {buildings.map((b) => (
        <Building key={b.id} b={b} />
      ))}

      {/* Lab equipment props */}
      {objects.map((o) => (
        <group key={o.id} position={[o.x, 0, o.z]}>
          <PropMesh kind={o.kind} sx={o.sx} sy={o.sy} sz={o.sz} color={o.color} />
        </group>
      ))}
    </group>
  );
}
