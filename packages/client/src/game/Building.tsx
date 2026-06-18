import { useMemo } from "react";
import * as THREE from "three";
import type { Building as BuildingData } from "@enzae/shared";

/** Deterministic 0..1 from coordinates so every client renders the same details. */
function hash(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Gable (pitched) roof: a triangular prism with eaves overhang. */
function useGableRoof(w: number, d: number, rh: number): THREE.BufferGeometry {
  return useMemo(() => {
    const ow = w / 2 + 0.35; // eaves overhang
    const od = d + 0.7;
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
      {/* frame */}
      <mesh>
        <boxGeometry args={[0.78, 0.86, 0.08]} />
        <meshStandardMaterial color="#efe7d6" roughness={0.8} />
      </mesh>
      {/* glowing glass with a cross muntin baked in via the frame color showing through */}
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.58, 0.66, 0.06]} />
        <meshStandardMaterial
          color="#bfe6ff"
          emissive="#ffe9a8"
          emissiveIntensity={0.5}
          roughness={0.25}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
}

export default function Building({ b }: { b: BuildingData }) {
  const rh = 1.1 + Math.min(b.w, b.d) * 0.22; // roof height scales with footprint
  const roofGeo = useGableRoof(b.w, b.d, rh);

  const h = b.h;
  const halfD = b.d / 2;
  const halfW = b.w / 2;
  const r = hash(b.x, b.z);
  const cols = Math.max(1, Math.min(3, Math.round(b.w / 2.4)));
  const hasChimney = r > 0.5;
  const upperRow = h > 4.2;

  // Front window x positions, leaving room for the door in the middle.
  const frontXs: number[] = [];
  for (let i = 0; i < cols; i++) {
    const t = cols === 1 ? 0 : i / (cols - 1) - 0.5;
    frontXs.push(t * (b.w - 1.4));
  }

  return (
    <group position={[b.x, 0, b.z]}>
      {/* stone plinth */}
      <mesh position={[0, 0.18, 0]} receiveShadow castShadow>
        <boxGeometry args={[b.w + 0.3, 0.36, b.d + 0.3]} />
        <meshStandardMaterial color="#8c8276" roughness={1} />
      </mesh>

      {/* walls */}
      <mesh position={[0, h / 2 + 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[b.w, h, b.d]} />
        <meshStandardMaterial color={b.color} roughness={0.92} />
      </mesh>

      {/* corner posts for a timbered look */}
      {[
        [-halfW, halfD],
        [halfW, halfD],
        [-halfW, -halfD],
        [halfW, -halfD],
      ].map(([cx, cz], i) => (
        <mesh key={i} position={[cx, h / 2 + 0.18, cz]} castShadow>
          <boxGeometry args={[0.22, h, 0.22]} />
          <meshStandardMaterial color="#6b5640" roughness={0.9} />
        </mesh>
      ))}

      {/* door (front, +z) */}
      <group position={[0, 0.18, halfD + 0.03]}>
        <mesh position={[0, 1.0, 0]} castShadow>
          <boxGeometry args={[1.05, 1.9, 0.16]} />
          <meshStandardMaterial color="#5b3b22" roughness={0.7} />
        </mesh>
        <mesh position={[0.32, 1.0, 0.1]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#e8c84a" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>

      {/* front windows */}
      {frontXs.map((x, i) =>
        Math.abs(x) < 0.7 ? null : <Window key={`f${i}`} x={x} y={h * 0.62 + 0.18} z={halfD + 0.02} />
      )}
      {upperRow &&
        frontXs.map((x, i) => (
          <Window key={`fu${i}`} x={x} y={h * 0.9 + 0.18} z={halfD + 0.02} />
        ))}

      {/* side windows */}
      <Window x={-halfW - 0.02} y={h * 0.62 + 0.18} z={0} ry={Math.PI / 2} />
      <Window x={halfW + 0.02} y={h * 0.62 + 0.18} z={0} ry={Math.PI / 2} />

      {/* gable roof */}
      <mesh geometry={roofGeo} position={[0, h + 0.18, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={b.roof} roughness={0.85} flatShading />
      </mesh>

      {hasChimney && (
        <mesh position={[halfW * 0.5, h + rh * 0.6 + 0.18, halfD * 0.2]} castShadow>
          <boxGeometry args={[0.5, 1.3, 0.5]} />
          <meshStandardMaterial color="#7a3b2a" roughness={1} />
        </mesh>
      )}
    </group>
  );
}
