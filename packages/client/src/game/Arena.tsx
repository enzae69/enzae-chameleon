import { useMemo } from "react";
import { generateMap, ARENA_SIZE, ARENA_HALF, WALL_THICKNESS } from "@enzae/shared";

const WALL_H = 2.2;

export default function Arena({ seed }: { seed: number }) {
  const objects = useMemo(() => generateMap(seed), [seed]);

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

      {walls.map((w, i) => (
        <mesh key={i} position={[w.x, WALL_H / 2, w.z]}>
          <boxGeometry args={[w.w, WALL_H, w.d]} />
          <meshStandardMaterial color="#0c241a" />
        </mesh>
      ))}

      {objects.map((o) => (
        <mesh key={o.id} position={[o.x, o.sy / 2, o.z]} castShadow>
          <boxGeometry args={[o.sx, o.sy, o.sz]} />
          <meshStandardMaterial color={o.color} />
        </mesh>
      ))}
    </group>
  );
}
