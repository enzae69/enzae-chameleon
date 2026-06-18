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
 * Renders a prop shape with its base sitting on y=0, so the caller positions the
 * parent group at the ground point [x, 0, z]. Shared by the arena props and by
 * disguised players (who morph into one of these shapes).
 */
export const PropMesh = forwardRef<THREE.MeshStandardMaterial, PropMeshProps>(
  ({ kind, sx, sy, sz, color = "#ffffff", opacity = 1, onPointerDown }, matRef) => {
    const transparent = opacity < 1;
    const mat = (
      <meshStandardMaterial ref={matRef} color={color} transparent={transparent} opacity={opacity} />
    );
    const dia = Math.max(sx, sz);

    switch (kind) {
      case "barrel":
        return (
          <mesh position={[0, sy / 2, 0]} castShadow onPointerDown={onPointerDown}>
            <cylinderGeometry args={[sx / 2, sx / 2, sy, 16]} />
            {mat}
          </mesh>
        );
      case "pillar":
        return (
          <mesh position={[0, sy / 2, 0]} castShadow onPointerDown={onPointerDown}>
            <cylinderGeometry args={[sx / 2, sx / 2, sy, 12]} />
            {mat}
          </mesh>
        );
      case "bush":
        return (
          <mesh position={[0, (sy || dia) / 2, 0]} castShadow onPointerDown={onPointerDown}>
            <icosahedronGeometry args={[dia / 2, 1]} />
            {mat}
          </mesh>
        );
      case "rock":
        return (
          <mesh
            position={[0, sy / 2.4, 0]}
            rotation={[0.3, 0.5, 0.2]}
            castShadow
            onPointerDown={onPointerDown}
          >
            <dodecahedronGeometry args={[dia / 2, 0]} />
            {mat}
          </mesh>
        );
      case "crate":
      default:
        return (
          <mesh position={[0, sy / 2, 0]} castShadow onPointerDown={onPointerDown}>
            <boxGeometry args={[sx, sy, sz]} />
            {mat}
          </mesh>
        );
    }
  }
);
PropMesh.displayName = "PropMesh";
