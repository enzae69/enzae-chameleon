import { forwardRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { PropKind } from "@enzae/shared";

interface PropMeshProps {
  kind: PropKind | string;
  sx: number;
  sy: number;
  sz: number;
  color?: string;
  opacity?: number;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
}

/**
 * Renders a prop shape with its base on y=0 (caller positions the parent group at
 * the ground point). The main shape carries the recolorable material (matRef) so
 * the same component renders both arena props and disguised players. Accent meshes
 * use fixed colors and match between the real prop and a player's disguise.
 */
export const PropMesh = forwardRef<THREE.MeshStandardMaterial, PropMeshProps>(
  ({ kind, sx, sy, sz, color = "#ffffff", opacity = 1, onPointerDown }, matRef) => {
    const transparent = opacity < 1;
    const mat = (
      <meshStandardMaterial
        ref={matRef}
        color={color}
        roughness={0.85}
        transparent={transparent}
        opacity={opacity}
      />
    );
    const dia = Math.max(sx, sz);
    const accent = "#000000";

    switch (kind) {
      case "barrel":
        return (
          <group onPointerDown={onPointerDown}>
            <mesh position={[0, sy / 2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[sx / 2, sx * 0.46, sy, 18]} />
              {mat}
            </mesh>
            {[0.24, 0.76].map((t, i) => (
              <mesh key={i} position={[0, sy * t, 0]}>
                <cylinderGeometry args={[sx / 2 + 0.04, sx / 2 + 0.04, 0.12, 18]} />
                <meshStandardMaterial color="#3a2c1c" roughness={0.6} metalness={0.3} />
              </mesh>
            ))}
          </group>
        );
      case "pillar":
        return (
          <group onPointerDown={onPointerDown}>
            <mesh position={[0, sy / 2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[sx / 2, sx / 2, sy, 16]} />
              {mat}
            </mesh>
            <mesh position={[0, 0.14, 0]} castShadow>
              <cylinderGeometry args={[sx * 0.66, sx * 0.7, 0.28, 16]} />
              <meshStandardMaterial color="#cfc6b0" roughness={0.9} />
            </mesh>
            <mesh position={[0, sy - 0.14, 0]} castShadow>
              <cylinderGeometry args={[sx * 0.7, sx * 0.66, 0.28, 16]} />
              <meshStandardMaterial color="#cfc6b0" roughness={0.9} />
            </mesh>
          </group>
        );
      case "tank": {
        // Containment tank: cylinder body, domed top, metal base + bands.
        const r = sx / 2;
        const bodyH = sy * 0.82;
        return (
          <group onPointerDown={onPointerDown}>
            <mesh position={[0, bodyH / 2 + 0.18, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[r, r, bodyH, 18]} />
              <meshStandardMaterial
                ref={matRef}
                color={color}
                roughness={0.4}
                metalness={0.35}
                transparent={transparent}
                opacity={opacity}
              />
            </mesh>
            <mesh position={[0, bodyH + 0.18, 0]} castShadow>
              <sphereGeometry args={[r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#aeb8bf" roughness={0.5} metalness={0.5} />
            </mesh>
            <mesh position={[0, 0.16, 0]} castShadow>
              <cylinderGeometry args={[r * 1.12, r * 1.18, 0.3, 18]} />
              <meshStandardMaterial color="#5b656b" roughness={0.8} metalness={0.4} />
            </mesh>
            {[0.35, 0.7].map((t, i) => (
              <mesh key={i} position={[0, bodyH * t + 0.18, 0]}>
                <cylinderGeometry args={[r + 0.03, r + 0.03, 0.1, 18]} />
                <meshStandardMaterial color="#5b656b" roughness={0.6} metalness={0.5} />
              </mesh>
            ))}
          </group>
        );
      }
      case "rock":
        return (
          <mesh
            position={[0, sy / 2.4, 0]}
            rotation={[0.3, 0.5, 0.2]}
            castShadow
            receiveShadow
            onPointerDown={onPointerDown}
          >
            <dodecahedronGeometry args={[dia / 2, 0]} />
            <meshStandardMaterial
              ref={matRef}
              color={color}
              roughness={1}
              flatShading
              transparent={transparent}
              opacity={opacity}
            />
          </mesh>
        );
      case "crate":
      default:
        return (
          <group onPointerDown={onPointerDown}>
            <mesh position={[0, sy / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[sx, sy, sz]} />
              {mat}
            </mesh>
            {/* diagonal plank + band for a wooden-crate read */}
            <mesh position={[0, sy / 2, sz / 2 + 0.01]} rotation={[0, 0, Math.PI / 4]}>
              <boxGeometry args={[Math.hypot(sx, sy) * 0.96, 0.12, 0.04]} />
              <meshStandardMaterial color={accent} roughness={0.7} transparent opacity={0.25} />
            </mesh>
            <mesh position={[0, sy / 2, 0]}>
              <boxGeometry args={[sx * 1.02, sy * 0.16, sz * 1.02]} />
              <meshStandardMaterial color="#6b4a2a" roughness={0.8} />
            </mesh>
          </group>
        );
    }
  }
);
PropMesh.displayName = "PropMesh";
