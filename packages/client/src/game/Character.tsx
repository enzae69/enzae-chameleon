import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import { PLAYER_HEIGHT } from "@enzae/shared";

const MODEL_URL = `${import.meta.env.BASE_URL}models/character.glb`;
useGLTF.preload(MODEL_URL);

// Extra yaw if the model's "front" isn't +z. Our rig faces +z (movement
// forward), so this stays 0.
const FACE_Y = 0;
// Below this normalised speed we play idle; above it, walk.
const MOVE_THRESHOLD = 0.12;

/**
 * The player character: a rigged stickman, auto-scaled to player height and
 * tinted to the player colour. It blends between a real idle and walk
 * animation (baked into the GLB) based on how fast the player is moving.
 * `speedRef` is 0..1 (movement speed).
 */
export default function Character({
  colorRef,
  speedRef,
  eliminatedRef,
}: {
  colorRef: React.MutableRefObject<string>;
  speedRef: React.MutableRefObject<number>;
  eliminatedRef: React.MutableRefObject<boolean>;
}) {
  const { scene, animations } = useGLTF(MODEL_URL);

  // Per-instance clone with an independent skeleton (SkeletonUtils, not a plain
  // clone, or every player would share one pose) and independent materials so
  // each player can be tinted separately.
  const model = useMemo(() => {
    const c = SkeletonUtils.clone(scene) as THREE.Object3D;
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = false;
        m.frustumCulled = false; // skinned bounds move; don't let it pop out
        m.material = (m.material as THREE.Material).clone();
      }
    });
    return c;
  }, [scene]);

  // Auto-fit: uniform scale to PLAYER_HEIGHT, centred on x/z, feet at y=0.
  const { scale, offset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const s = PLAYER_HEIGHT / (size.y || 1);
    return {
      scale: s,
      offset: new THREE.Vector3(-center.x * s, -box.min.y * s, -center.z * s),
    };
  }, [model]);

  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  useLayoutEffect(() => {
    const list: THREE.MeshStandardMaterial[] = [];
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) list.push(m.material as THREE.MeshStandardMaterial);
    });
    mats.current = list;
  }, [model]);

  // Drive both clips at once and crossfade by weight — smoother than stopping
  // and starting actions every time the player halts.
  const { actions } = useAnimations(animations, model);
  const walkW = useRef(0);
  useEffect(() => {
    const idle = actions.idle;
    const walk = actions.walk;
    idle?.reset().play();
    walk?.reset().play();
    idle?.setEffectiveWeight(1);
    walk?.setEffectiveWeight(0);
    return () => {
      idle?.stop();
      walk?.stop();
    };
  }, [actions]);

  useFrame((_, dt) => {
    const eliminated = eliminatedRef.current;
    for (const m of mats.current) {
      if (m.color) m.color.set(colorRef.current);
      m.transparent = eliminated;
      m.opacity = eliminated ? 0.25 : 1;
    }
    const sp = Math.min(1, Math.max(0, speedRef.current));
    const target = sp > MOVE_THRESHOLD ? 1 : 0;
    walkW.current += (target - walkW.current) * Math.min(1, dt * 12);
    const walk = actions.walk;
    const idle = actions.idle;
    if (walk) {
      walk.setEffectiveWeight(walkW.current);
      walk.timeScale = 0.7 + sp * 1.1; // faster movement → quicker steps
    }
    if (idle) idle.setEffectiveWeight(1 - walkW.current);
  });

  return (
    <group rotation={[0, FACE_Y, 0]}>
      <group position={offset} scale={scale}>
        <primitive object={model} />
      </group>
    </group>
  );
}
