import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BUILDING_WALL_T, BUILDING_DOOR_W, type Building as BuildingData } from "@enzae/shared";
import { live } from "../net/live";
import { registerCollider, unregisterCollider } from "./colliders";

const T = BUILDING_WALL_T; // wall thickness (shared with collision)
const DOOR_W = BUILDING_DOOR_W; // door opening width (shared with collision)
const DOOR_H = 2.25;

function hash(x: number, z: number, salt = 0): number {
  const s = Math.sin((x + salt) * 12.9898 + (z - salt) * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function useGableRoof(w: number, d: number, rh: number): THREE.BufferGeometry {
  return useMemo(() => {
    const ow = w / 2 + 0.4;
    const od = d + 0.8;
    const shape = new THREE.Shape();
    shape.moveTo(-ow, 0);
    shape.lineTo(ow, 0);
    shape.lineTo(0, rh);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: od, bevelEnabled: false });
    geo.translate(0, 0, -od / 2);
    geo.computeVertexNormals();
    return geo;
  }, [w, d, rh]);
}

function Window({ x, y, z, ry = 0 }: { x: number; y: number; z: number; ry?: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, ry, 0]}>
      <mesh>
        <boxGeometry args={[0.82, 0.9, 0.12]} />
        <meshStandardMaterial color="#efe7d6" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.6, 0.68, 0.1]} />
        <meshStandardMaterial color="#bfe6ff" emissive="#ffe9a8" emissiveIntensity={0.5} roughness={0.25} />
      </mesh>
    </group>
  );
}

/* ---- interior furniture (simple primitives) ---- */

function Table({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  const w = 1.0 * s;
  const d = 0.7 * s;
  const legs: [number, number][] = [
    [w / 2 - 0.08, d / 2 - 0.08],
    [-w / 2 + 0.08, d / 2 - 0.08],
    [w / 2 - 0.08, -d / 2 + 0.08],
    [-w / 2 + 0.08, -d / 2 + 0.08],
  ];
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.1, d]} />
        <meshStandardMaterial color="#8a5a32" roughness={0.7} />
      </mesh>
      {legs.map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.37, lz]} castShadow>
          <boxGeometry args={[0.1, 0.74, 0.1]} />
          <meshStandardMaterial color="#6b4423" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Stool({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, 0.28, z]} castShadow>
      <cylinderGeometry args={[0.2, 0.22, 0.56, 10]} />
      <meshStandardMaterial color="#7a5230" roughness={0.8} />
    </mesh>
  );
}

function Bed({ x, z, len }: { x: number; z: number; len: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.34, len]} />
        <meshStandardMaterial color="#5b6e8c" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.46, -len / 2 + 0.35]} castShadow>
        <boxGeometry args={[0.95, 0.18, 0.5]} />
        <meshStandardMaterial color="#eef2f7" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.44, 0.25]} castShadow>
        <boxGeometry args={[1.04, 0.12, len - 1.0]} />
        <meshStandardMaterial color="#b34a4a" roughness={0.95} />
      </mesh>
    </group>
  );
}

function Shelf({ x, z, ry = 0 }: { x: number; z: number; ry?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 1.6, 0.35]} />
        <meshStandardMaterial color="#6b4423" roughness={0.85} />
      </mesh>
      {[0.45, 0.95, 1.4].map((y, i) => (
        <mesh key={i} position={[0, y, 0.04]}>
          <boxGeometry args={[0.86, 0.05, 0.32]} />
          <meshStandardMaterial color="#8a5a32" />
        </mesh>
      ))}
    </group>
  );
}

function Rug({ x, z, w, d }: { x: number; z: number; w: number; d: number }) {
  return (
    <mesh position={[x, 0.14, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color="#9c5b4a" roughness={1} />
    </mesh>
  );
}

export default function Building({ b }: { b: BuildingData }) {
  const rh = 1.0 + Math.min(b.w, b.d) * 0.2;
  const roofGeo = useGableRoof(b.w, b.d, rh);
  const roofMat = useRef<THREE.MeshStandardMaterial>(null!);
  const wallsRef = useRef<THREE.Group>(null);

  const h = b.h;
  const halfW = b.w / 2;
  const halfD = b.d / 2;
  const segW = (b.w - DOOR_W) / 2; // front wall segments beside the door
  const segX = (b.w + DOOR_W) / 4;
  const r = hash(b.x, b.z);

  // Register only the structural walls for camera collision (not furniture/roof).
  useEffect(() => {
    const g = wallsRef.current;
    registerCollider(g);
    return () => unregisterCollider(g);
  }, []);

  // Fade the roof out when the local player steps inside this building.
  useFrame((_, dt) => {
    const m = roofMat.current;
    if (!m) return;
    const dx = live.selfX - b.x;
    const dz = live.selfZ - b.z;
    const ca = Math.cos(b.rotY);
    const sa = Math.sin(b.rotY);
    const lx = dx * ca - dz * sa;
    const lz = dx * sa + dz * ca;
    const inside = Math.abs(lx) < halfW + 0.4 && Math.abs(lz) < halfD + 0.4;
    const want = inside ? 0.1 : 1;
    m.opacity += (want - m.opacity) * Math.min(1, dt * 6);
    m.transparent = m.opacity < 0.985;
  });

  // Interior layout sizing that fits the footprint.
  const ix = halfW - 0.55;
  const iz = halfD - 0.55;
  const bedLen = Math.min(1.95, b.d - 1.2);
  const hasBed = b.d > 5 && r > 0.35;

  return (
    <group position={[b.x, 0, b.z]} rotation={[0, b.rotY, 0]}>
      {/* stone plinth + wooden floor */}
      <mesh position={[0, 0.18, 0]} receiveShadow castShadow>
        <boxGeometry args={[b.w + 0.3, 0.36, b.d + 0.3]} />
        <meshStandardMaterial color="#8c8276" roughness={1} />
      </mesh>
      <mesh position={[0, 0.37, 0]} receiveShadow>
        <boxGeometry args={[b.w - 0.1, 0.06, b.d - 0.1]} />
        <meshStandardMaterial color="#7c5a36" roughness={0.9} />
      </mesh>

      {/* structural walls (collider) */}
      <group ref={wallsRef}>
        <mesh position={[0, h / 2 + 0.18, -halfD]} castShadow receiveShadow>
          <boxGeometry args={[b.w, h, T]} />
          <meshStandardMaterial color={b.color} roughness={0.92} />
        </mesh>
        <mesh position={[-halfW, h / 2 + 0.18, 0]} castShadow receiveShadow>
          <boxGeometry args={[T, h, b.d]} />
          <meshStandardMaterial color={b.color} roughness={0.92} />
        </mesh>
        <mesh position={[halfW, h / 2 + 0.18, 0]} castShadow receiveShadow>
          <boxGeometry args={[T, h, b.d]} />
          <meshStandardMaterial color={b.color} roughness={0.92} />
        </mesh>
        {/* front wall with a door opening */}
        <mesh position={[-segX, h / 2 + 0.18, halfD]} castShadow receiveShadow>
          <boxGeometry args={[segW, h, T]} />
          <meshStandardMaterial color={b.color} roughness={0.92} />
        </mesh>
        <mesh position={[segX, h / 2 + 0.18, halfD]} castShadow receiveShadow>
          <boxGeometry args={[segW, h, T]} />
          <meshStandardMaterial color={b.color} roughness={0.92} />
        </mesh>
        <mesh position={[0, DOOR_H + (h - DOOR_H) / 2 + 0.18, halfD]} castShadow>
          <boxGeometry args={[DOOR_W, h - DOOR_H, T]} />
          <meshStandardMaterial color={b.color} roughness={0.92} />
        </mesh>
      </group>

      {/* corner posts */}
      {[
        [-halfW, halfD],
        [halfW, halfD],
        [-halfW, -halfD],
        [halfW, -halfD],
      ].map(([cx, cz], i) => (
        <mesh key={i} position={[cx, h / 2 + 0.18, cz]} castShadow>
          <boxGeometry args={[0.24, h, 0.24]} />
          <meshStandardMaterial color="#6b5640" roughness={0.9} />
        </mesh>
      ))}

      {/* door frame + open door leaf */}
      <mesh position={[-DOOR_W / 2, DOOR_H / 2 + 0.18, halfD]} castShadow>
        <boxGeometry args={[0.12, DOOR_H, T + 0.05]} />
        <meshStandardMaterial color="#5b3b22" roughness={0.7} />
      </mesh>
      <mesh position={[DOOR_W / 2, DOOR_H / 2 + 0.18, halfD]} castShadow>
        <boxGeometry args={[0.12, DOOR_H, T + 0.05]} />
        <meshStandardMaterial color="#5b3b22" roughness={0.7} />
      </mesh>
      <mesh
        position={[DOOR_W / 2 - 0.1, DOOR_H / 2 + 0.18, halfD + 0.55]}
        rotation={[0, -1.1, 0]}
        castShadow
      >
        <boxGeometry args={[1.0, DOOR_H - 0.1, 0.08]} />
        <meshStandardMaterial color="#6b4423" roughness={0.7} />
      </mesh>

      {/* windows on back + sides */}
      <Window x={-b.w * 0.22} y={h * 0.6 + 0.18} z={-halfD - 0.02} ry={Math.PI} />
      <Window x={b.w * 0.22} y={h * 0.6 + 0.18} z={-halfD - 0.02} ry={Math.PI} />
      <Window x={-halfW - 0.02} y={h * 0.6 + 0.18} z={0} ry={-Math.PI / 2} />
      <Window x={halfW + 0.02} y={h * 0.6 + 0.18} z={0} ry={Math.PI / 2} />

      {/* interior furniture */}
      <Rug x={0} z={0.2} w={Math.min(b.w - 1.4, 2.6)} d={Math.min(b.d - 1.4, 1.9)} />
      <Table x={0} z={0.2} s={Math.min(1.2, b.w / 5)} />
      <Stool x={0.75} z={0.2} />
      <Stool x={-0.75} z={0.2} />
      <Shelf x={-ix + 0.2} z={-iz + 0.5} ry={Math.PI / 2} />
      {hasBed && <Bed x={ix - 0.7} z={-iz + bedLen / 2 + 0.1} len={bedLen} />}

      {/* gable roof (fades when you're inside) */}
      <mesh geometry={roofGeo} position={[0, h + 0.18, 0]} castShadow receiveShadow>
        <meshStandardMaterial ref={roofMat} color={b.roof} roughness={0.85} flatShading />
      </mesh>

      {r > 0.5 && (
        <mesh position={[halfW * 0.5, h + rh * 0.55 + 0.18, -halfD * 0.3]} castShadow>
          <boxGeometry args={[0.5, 1.3, 0.5]} />
          <meshStandardMaterial color="#7a3b2a" roughness={1} />
        </mesh>
      )}
    </group>
  );
}
