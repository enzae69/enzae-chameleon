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

const HEDGE_H = 2.4;

export default function Arena({ seed }: { seed: number }) {
  const objects = useMemo(() => generateMap(seed), [seed]);
  const buildings = useMemo(() => generateBuildings(seed), [seed]);
  const colliderRef = useRef<THREE.Group>(null);

  // Register hedges + buildings so the camera can pull in when they block the view.
  useEffect(() => {
    const g = colliderRef.current;
    registerCollider(g);
    return () => unregisterCollider(g);
  }, []);

  const hedges = [
    { x: 0, z: -ARENA_HALF, w: ARENA_SIZE + WALL_THICKNESS, d: WALL_THICKNESS },
    { x: 0, z: ARENA_HALF, w: ARENA_SIZE + WALL_THICKNESS, d: WALL_THICKNESS },
    { x: -ARENA_HALF, z: 0, w: WALL_THICKNESS, d: ARENA_SIZE },
    { x: ARENA_HALF, z: 0, w: WALL_THICKNESS, d: ARENA_SIZE },
  ];

  return (
    <group>
      {/* Far ground so the world doesn't visibly end (fades into fog/horizon). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#6f9b4a" roughness={1} />
      </mesh>

      {/* Play-field lawn */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ARENA_SIZE, ARENA_SIZE]} />
        <meshStandardMaterial color="#7cb04e" roughness={1} />
      </mesh>

      {/* Soft central plaza disc for a focal point */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <circleGeometry args={[7, 48]} />
        <meshStandardMaterial color="#c9b48a" roughness={1} />
      </mesh>

      {/* Hedges around the arena (camera collider) */}
      <group ref={colliderRef}>
        {hedges.map((w, i) => (
          <group key={i} position={[w.x, 0, w.z]}>
            <mesh position={[0, HEDGE_H / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w.w, HEDGE_H, w.d]} />
              <meshStandardMaterial color="#3f7a39" roughness={1} flatShading />
            </mesh>
            {/* lighter trimmed top */}
            <mesh position={[0, HEDGE_H + 0.08, 0]}>
              <boxGeometry args={[w.w + 0.1, 0.18, w.d + 0.1]} />
              <meshStandardMaterial color="#56913f" roughness={1} flatShading />
            </mesh>
          </group>
        ))}
      </group>

      {/* Walk-in houses (each registers its own walls as colliders) */}
      {buildings.map((b) => (
        <Building key={b.id} b={b} />
      ))}

      {/* Props of varied shapes */}
      {objects.map((o) => (
        <group key={o.id} position={[o.x, 0, o.z]}>
          <PropMesh kind={o.kind} sx={o.sx} sy={o.sy} sz={o.sz} color={o.color} />
        </group>
      ))}
    </group>
  );
}
