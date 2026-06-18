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
import { registerCollider, unregisterCollider } from "./colliders";

const WALL_H = 2.2;

export default function Arena({ seed }: { seed: number }) {
  const objects = useMemo(() => generateMap(seed), [seed]);
  const buildings = useMemo(() => generateBuildings(seed), [seed]);
  const colliderRef = useRef<THREE.Group>(null);

  // Register walls + buildings so the camera can pull in when they block the view.
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ARENA_SIZE, ARENA_SIZE]} />
        <meshStandardMaterial color="#163a28" />
      </mesh>

      <gridHelper args={[ARENA_SIZE, ARENA_SIZE, "#1f5238", "#143524"]} position={[0, 0.01, 0]} />

      <group ref={colliderRef}>
        {walls.map((w, i) => (
          <mesh key={i} position={[w.x, WALL_H / 2, w.z]}>
            <boxGeometry args={[w.w, WALL_H, w.d]} />
            <meshStandardMaterial color="#0c241a" />
          </mesh>
        ))}

        {/* Buildings: wall block + roof slab */}
        {buildings.map((b) => (
          <group key={b.id} position={[b.x, 0, b.z]}>
            <mesh position={[0, b.h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[b.w, b.h, b.d]} />
              <meshStandardMaterial color={b.color} />
            </mesh>
            <mesh position={[0, b.h + 0.15, 0]} castShadow>
              <boxGeometry args={[b.w + 0.6, 0.3, b.d + 0.6]} />
              <meshStandardMaterial color={b.roof} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Props of varied shapes */}
      {objects.map((o) => (
        <group key={o.id} position={[o.x, 0, o.z]}>
          <PropMesh kind={o.kind} sx={o.sx} sy={o.sy} sz={o.sz} color={o.color} />
        </group>
      ))}
    </group>
  );
}
