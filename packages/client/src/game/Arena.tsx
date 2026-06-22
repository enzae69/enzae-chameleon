import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  generateMap,
  generateBuildings,
  generateWalls,
  ARENA_SIZE,
  ARENA_HALF,
  DECK_DEPTH,
  DECK_HALF_W,
} from "@enzae/shared";
import { PropMesh } from "./Prop";
import Building from "./Building";
import { registerCollider, unregisterCollider } from "./colliders";

export default function Arena({ seed }: { seed: number }) {
  const objects = useMemo(() => generateMap(seed), [seed]);
  const buildings = useMemo(() => generateBuildings(seed), [seed]);
  const wallSegs = useMemo(() => generateWalls(seed), [seed]);
  const colliderRef = useRef<THREE.Group>(null);

  // Register all walls so the camera pulls in behind them.
  useEffect(() => {
    const g = colliderRef.current;
    registerCollider(g);
    return () => unregisterCollider(g);
  }, []);

  return (
    <group>
      {/* Outer apron so the world doesn't visibly end. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[560, 560]} />
        <meshStandardMaterial color="#3c4248" roughness={1} />
      </mesh>

      {/* Lab tile floor + grid */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ARENA_SIZE, ARENA_SIZE]} />
        <meshStandardMaterial color="#b9c2c8" roughness={0.85} metalness={0.05} />
      </mesh>
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

      {/* Outside deck (east, through the exit) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[ARENA_HALF + DECK_DEPTH / 2, 0.006, 0]}
        receiveShadow
      >
        <planeGeometry args={[DECK_DEPTH, DECK_HALF_W * 2]} />
        <meshStandardMaterial color="#717a82" roughness={0.7} metalness={0.25} />
      </mesh>

      {/* Walls: rooms (interior), perimeter (with exit), deck rails */}
      <group ref={colliderRef}>
        {wallSegs.map((w, i) => {
          const isRail = w.kind === "rail";
          const isPerim = w.kind === "perimeter";
          const h = isRail ? 1.1 : isPerim ? 4.6 : 3.6;
          const color = isRail ? "#79838b" : isPerim ? "#9aa4ac" : "#aeb8bf";
          return (
            <group key={i} position={[w.cx, 0, w.cz]}>
              <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[w.hx * 2, h, w.hz * 2]} />
                <meshStandardMaterial color={color} roughness={0.65} metalness={0.2} />
              </mesh>
              {isPerim && (
                <mesh position={[0, 0.5, 0]}>
                  <boxGeometry args={[w.hx * 2 + 0.02, 0.6, w.hz * 2 + 0.02]} />
                  <meshStandardMaterial color="#d9a21a" roughness={0.7} />
                </mesh>
              )}
              {!isRail && (
                <mesh position={[0, h + 0.08, 0]}>
                  <boxGeometry args={[w.hx * 2 + 0.12, 0.16, w.hz * 2 + 0.12]} />
                  <meshStandardMaterial color="#5b656b" roughness={0.6} metalness={0.4} />
                </mesh>
              )}
            </group>
          );
        })}
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
