import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BUILDING_WALL_T, BUILDING_DOOR_W, type Building as BuildingData } from "@enzae/shared";
import { live } from "../net/live";
import { registerCollider, unregisterCollider } from "./colliders";

const T = BUILDING_WALL_T; // wall thickness (shared with collision)
const DOOR_W = BUILDING_DOOR_W; // door opening width (shared with collision)
const DOOR_H = 2.3;

function hash(x: number, z: number, salt = 0): number {
  const s = Math.sin((x + salt) * 12.9898 + (z - salt) * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function Window({ x, y, z, ry = 0 }: { x: number; y: number; z: number; ry?: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, ry, 0]}>
      <mesh>
        <boxGeometry args={[1.0, 1.0, 0.12]} />
        <meshStandardMaterial color="#5b656b" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.78, 0.78, 0.1]} />
        <meshStandardMaterial color="#bfe6ff" emissive="#7fdfff" emissiveIntensity={0.45} roughness={0.2} metalness={0.1} />
      </mesh>
    </group>
  );
}

/* ---- lab interior equipment ---- */

function LabBench({ x, z, len, ry = 0 }: { x: number; z: number; len: number; ry?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
        <boxGeometry args={[len, 0.68, 0.6]} />
        <meshStandardMaterial color="#dfe4e8" roughness={0.5} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        <boxGeometry args={[len + 0.06, 0.06, 0.66]} />
        <meshStandardMaterial color="#3b4248" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[len * 0.28, 0.97, -0.12]} castShadow>
        <boxGeometry args={[0.44, 0.32, 0.05]} />
        <meshStandardMaterial color="#0e1418" emissive="#39e0ff" emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      <mesh position={[-len * 0.28, 0.87, 0.06]}>
        <cylinderGeometry args={[0.07, 0.09, 0.24, 10]} />
        <meshStandardMaterial color="#37a85f" emissive="#37a85f" emissiveIntensity={0.35} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

function ServerRack({ x, z, ry = 0 }: { x: number; z: number; ry?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <mesh position={[0, 0.98, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 1.96, 0.7]} />
        <meshStandardMaterial color="#23282d" roughness={0.5} metalness={0.4} />
      </mesh>
      {[0.45, 0.85, 1.25, 1.65].map((y, i) => (
        <mesh key={i} position={[0, y, 0.36]}>
          <boxGeometry args={[0.62, 0.12, 0.04]} />
          <meshStandardMaterial
            color="#0a0f12"
            emissive={i % 2 ? "#39e0ff" : "#37a85f"}
            emissiveIntensity={0.6}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function ContainmentTank({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.02, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 1.7, 18]} />
        <meshStandardMaterial color="#4aa0d6" emissive="#3a78c2" emissiveIntensity={0.25} transparent opacity={0.62} roughness={0.15} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.13, 0]} castShadow>
        <cylinderGeometry args={[0.58, 0.62, 0.26, 18]} />
        <meshStandardMaterial color="#5b656b" metalness={0.5} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.96, 0]}>
        <cylinderGeometry args={[0.54, 0.5, 0.18, 18]} />
        <meshStandardMaterial color="#5b656b" metalness={0.5} roughness={0.6} />
      </mesh>
    </group>
  );
}

export default function Building({ b }: { b: BuildingData }) {
  const roofGroup = useRef<THREE.Group>(null);
  const roofOp = useRef(1);
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

  // Fade the roof out when the local player steps inside this module.
  useFrame((_, dt) => {
    const grp = roofGroup.current;
    if (!grp) return;
    const dx = live.selfX - b.x;
    const dz = live.selfZ - b.z;
    const ca = Math.cos(b.rotY);
    const sa = Math.sin(b.rotY);
    const lx = dx * ca - dz * sa;
    const lz = dx * sa + dz * ca;
    const inside = Math.abs(lx) < halfW + 0.4 && Math.abs(lz) < halfD + 0.4;
    const want = inside ? 0.08 : 1;
    roofOp.current += (want - roofOp.current) * Math.min(1, dt * 6);
    const op = roofOp.current;
    const transparent = op < 0.985;
    grp.traverse((o) => {
      const m = (o as THREE.Mesh).material as
        | (THREE.Material & { opacity: number; transparent: boolean })
        | undefined;
      if (m) {
        m.opacity = op;
        m.transparent = transparent;
      }
    });
  });

  const ix = halfW - 0.7;
  const iz = halfD - 0.7;
  const benchLen = Math.min(b.w - 1.8, 3.6);
  const wallMat = { color: b.color, roughness: 0.6, metalness: 0.15 };

  return (
    <group position={[b.x, 0, b.z]} rotation={[0, b.rotY, 0]}>
      {/* metal base + lab tile floor */}
      <mesh position={[0, 0.18, 0]} receiveShadow castShadow>
        <boxGeometry args={[b.w + 0.3, 0.36, b.d + 0.3]} />
        <meshStandardMaterial color="#6b7178" roughness={0.7} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.37, 0]} receiveShadow>
        <boxGeometry args={[b.w - 0.1, 0.06, b.d - 0.1]} />
        <meshStandardMaterial color="#cdd4d9" roughness={0.7} />
      </mesh>

      {/* structural walls (collider) */}
      <group ref={wallsRef}>
        <mesh position={[0, h / 2 + 0.18, -halfD]} castShadow receiveShadow>
          <boxGeometry args={[b.w, h, T]} />
          <meshStandardMaterial {...wallMat} />
        </mesh>
        <mesh position={[-halfW, h / 2 + 0.18, 0]} castShadow receiveShadow>
          <boxGeometry args={[T, h, b.d]} />
          <meshStandardMaterial {...wallMat} />
        </mesh>
        <mesh position={[halfW, h / 2 + 0.18, 0]} castShadow receiveShadow>
          <boxGeometry args={[T, h, b.d]} />
          <meshStandardMaterial {...wallMat} />
        </mesh>
        {/* front wall with a door opening */}
        <mesh position={[-segX, h / 2 + 0.18, halfD]} castShadow receiveShadow>
          <boxGeometry args={[segW, h, T]} />
          <meshStandardMaterial {...wallMat} />
        </mesh>
        <mesh position={[segX, h / 2 + 0.18, halfD]} castShadow receiveShadow>
          <boxGeometry args={[segW, h, T]} />
          <meshStandardMaterial {...wallMat} />
        </mesh>
        <mesh position={[0, DOOR_H + (h - DOOR_H) / 2 + 0.18, halfD]} castShadow>
          <boxGeometry args={[DOOR_W, h - DOOR_H, T]} />
          <meshStandardMaterial {...wallMat} />
        </mesh>
      </group>

      {/* metal corner posts */}
      {[
        [-halfW, halfD],
        [halfW, halfD],
        [-halfW, -halfD],
        [halfW, -halfD],
      ].map(([cx, cz], i) => (
        <mesh key={i} position={[cx, h / 2 + 0.18, cz]} castShadow>
          <boxGeometry args={[0.26, h, 0.26]} />
          <meshStandardMaterial color="#5b656b" roughness={0.5} metalness={0.5} />
        </mesh>
      ))}

      {/* sliding door frame + leaf */}
      <mesh position={[0, DOOR_H + 0.28, halfD]} castShadow>
        <boxGeometry args={[DOOR_W + 0.3, 0.2, T + 0.08]} />
        <meshStandardMaterial color="#e0b020" roughness={0.6} />
      </mesh>
      <mesh position={[-DOOR_W / 2 + 0.25, DOOR_H / 2 + 0.18, halfD + 0.04]} castShadow>
        <boxGeometry args={[0.5, DOOR_H - 0.1, 0.06]} />
        <meshStandardMaterial color="#9aa4ac" roughness={0.4} metalness={0.5} />
      </mesh>

      {/* lab windows */}
      <Window x={-b.w * 0.24} y={h * 0.62 + 0.18} z={-halfD - 0.02} ry={Math.PI} />
      <Window x={b.w * 0.24} y={h * 0.62 + 0.18} z={-halfD - 0.02} ry={Math.PI} />
      <Window x={-halfW - 0.02} y={h * 0.62 + 0.18} z={0} ry={-Math.PI / 2} />
      <Window x={halfW + 0.02} y={h * 0.62 + 0.18} z={0} ry={Math.PI / 2} />

      {/* interior equipment */}
      <LabBench x={0} z={-iz + 0.4} len={benchLen} />
      <ServerRack x={-ix + 0.45} z={-iz + 0.5} ry={Math.PI / 2} />
      {r > 0.35 && <ContainmentTank x={ix - 0.6} z={-iz + 0.7} />}
      {b.w > 9 && <LabBench x={ix - 0.5} z={1.2} len={Math.min(b.d - 2.0, 3.0)} ry={Math.PI / 2} />}

      {/* flat roof (fades when you're inside) */}
      <group ref={roofGroup}>
        <mesh position={[0, h + 0.34, 0]} castShadow receiveShadow>
          <boxGeometry args={[b.w + 0.4, 0.32, b.d + 0.4]} />
          <meshStandardMaterial color={b.roof} roughness={0.7} metalness={0.25} />
        </mesh>
        {/* roof vent / AC unit */}
        <mesh position={[halfW * 0.4, h + 0.7, -halfD * 0.4]} castShadow>
          <boxGeometry args={[1.0, 0.5, 0.8]} />
          <meshStandardMaterial color="#7d878e" roughness={0.6} metalness={0.4} />
        </mesh>
      </group>
    </group>
  );
}
