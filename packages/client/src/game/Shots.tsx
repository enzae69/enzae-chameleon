import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useEffects, type ShotFx } from "../store/effectsStore";

const UP = new THREE.Vector3(0, 1, 0);
const Y_FROM = 1.15; // muzzle height
const Y_TO = 1.0; // target chest height

const LASER_COLOR = "#ff5230";
const TASER_COLOR = "#5ad7ff";
const LIFE = { laser: 190, taser: 280 } as const;

function Beam({ fx }: { fx: ShotFx }) {
  const remove = useEffects((s) => s.removeShot);
  const group = useRef<THREE.Group>(null!);
  const born = useRef(performance.now());
  const mats = useRef<THREE.Material[]>([]);

  const { position, quaternion, length, color, life } = useMemo(() => {
    const from = new THREE.Vector3(fx.from[0], Y_FROM, fx.from[2]);
    const to = new THREE.Vector3(fx.to[0], Y_TO, fx.to[2]);
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = Math.max(0.001, dir.length());
    const mid = from.clone().addScaledVector(dir, 0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
    return {
      position: mid,
      quaternion: q,
      length: len,
      color: fx.weapon === "laser" ? LASER_COLOR : TASER_COLOR,
      life: LIFE[fx.weapon],
    };
  }, [fx]);

  // Jagged offsets for the taser arc.
  const zig = useMemo(
    () =>
      fx.weapon === "taser"
        ? Array.from({ length: 4 }, () => (Math.random() - 0.5) * 0.5)
        : [],
    [fx]
  );

  useFrame(() => {
    const t = (performance.now() - born.current) / life;
    if (t >= 1) {
      remove(fx.id);
      return;
    }
    const fade = 1 - t;
    for (const m of mats.current) {
      (m as THREE.Material & { opacity: number }).opacity = fade;
    }
    if (group.current) {
      const flick = fx.weapon === "taser" ? 0.7 + Math.random() * 0.3 : 1;
      group.current.scale.x = flick;
      group.current.scale.z = flick;
    }
  });

  const setMat = (i: number) => (m: THREE.Material | null) => {
    if (m) mats.current[i] = m;
  };

  return (
    <group position={position} quaternion={quaternion} ref={group}>
      {/* outer glow */}
      <mesh>
        <cylinderGeometry args={[fx.weapon === "laser" ? 0.1 : 0.07, fx.weapon === "laser" ? 0.1 : 0.07, length, 8]} />
        <meshBasicMaterial ref={setMat(0)} color={color} transparent opacity={1} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* bright core */}
      <mesh>
        <cylinderGeometry args={[0.028, 0.028, length, 6]} />
        <meshBasicMaterial ref={setMat(1)} color="#ffffff" transparent opacity={1} toneMapped={false} depthWrite={false} />
      </mesh>
      {/* taser crackle */}
      {zig.map((off, i) => (
        <mesh key={i} position={[off, (i / zig.length - 0.5) * length, off * 0.6]}>
          <sphereGeometry args={[0.09, 6, 6]} />
          <meshBasicMaterial ref={setMat(2 + i)} color={TASER_COLOR} transparent opacity={1} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
      {/* muzzle + impact flashes */}
      <mesh position={[0, -length / 2, 0]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshBasicMaterial ref={setMat(8)} color={color} transparent opacity={1} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {fx.hit && (
        <mesh position={[0, length / 2, 0]}>
          <sphereGeometry args={[0.32, 10, 10]} />
          <meshBasicMaterial ref={setMat(9)} color={color} transparent opacity={1} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

export default function Shots() {
  const shots = useEffects((s) => s.shots);
  return (
    <>
      {shots.map((fx) => (
        <Beam key={fx.id} fx={fx} />
      ))}
    </>
  );
}
