import { PLAYER_HEIGHT, PLAYER_RADIUS } from "@enzae/shared";

/** Small blaster held in front of a seeker, pointing forward (+z). */
export default function Blaster() {
  return (
    <group position={[PLAYER_RADIUS * 0.7, PLAYER_HEIGHT * 0.58, PLAYER_RADIUS * 0.5]}>
      {/* grip */}
      <mesh position={[0, -0.12, -0.08]} rotation={[0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.1, 0.22, 0.12]} />
        <meshStandardMaterial color="#2b2f36" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* body */}
      <mesh castShadow>
        <boxGeometry args={[0.13, 0.16, 0.42]} />
        <meshStandardMaterial color="#3a4049" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* barrel */}
      <mesh position={[0, 0.02, 0.32]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.34, 10]} />
        <meshStandardMaterial color="#23262b" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* glowing muzzle tip */}
      <mesh position={[0, 0.02, 0.5]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshStandardMaterial color="#5ad7ff" emissive="#5ad7ff" emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      {/* energy cell */}
      <mesh position={[0, 0.12, -0.08]}>
        <boxGeometry args={[0.08, 0.08, 0.16]} />
        <meshStandardMaterial color="#ff5230" emissive="#ff5230" emissiveIntensity={0.9} toneMapped={false} />
      </mesh>
    </group>
  );
}
