import { useLayoutEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLAYER_HEIGHT } from "@enzae/shared";

const MODEL_URL = `${import.meta.env.BASE_URL}models/character.glb`;
useGLTF.preload(MODEL_URL);

// Tweakables in case the model needs reorienting.
const FACE_Y = 0; // extra yaw so the model faces +z (forward)

/**
 * The player character: the white stickman model, auto-scaled to player height,
 * tinted to the player colour, with a procedural walk bob (the model has no rig).
 * `speedRef` is 0..1 (how fast we're moving) and drives the bob.
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
  const { scene } = useGLTF(MODEL_URL);

  // Independent clone (geometry shared, materials cloned for tinting).
  // The model is authored Z-up, so stand it up (Z-up → Y-up).
  const model = useMemo(() => {
    const c = scene.clone(true);
    c.rotation.x = -Math.PI / 2;
    c.updateMatrixWorld(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if ((m as THREE.Mesh).isMesh) {
        m.castShadow = true;
        m.receiveShadow = false;
        m.material = (m.material as THREE.Material).clone();
      }
    });
    return c;
  }, [scene]);

  // Auto-fit: uniform scale to PLAYER_HEIGHT, centred on x/z, feet at y=0.
  const { scale, offset } = useMemo(() => {
    model.updateMatrixWorld(true);
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
      if ((m as THREE.Mesh).isMesh) list.push(m.material as THREE.MeshStandardMaterial);
    });
    mats.current = list;
  }, [model]);

  const inner = useRef<THREE.Group>(null!);
  const walk = useRef(0);

  useFrame((_, dt) => {
    const eliminated = eliminatedRef.current;
    for (const m of mats.current) {
      if (m.color) m.color.set(colorRef.current);
      m.transparent = eliminated;
      m.opacity = eliminated ? 0.25 : 1;
    }
    const sp = Math.min(1, Math.max(0, speedRef.current));
    walk.current += dt * 11 * sp;
    const g = inner.current;
    if (g) {
      g.position.y = offset.y + Math.abs(Math.sin(walk.current)) * 0.07 * sp;
      g.rotation.z = Math.sin(walk.current) * 0.06 * sp;
    }
  });

  return (
    <group rotation={[0, FACE_Y, 0]}>
      <group ref={inner} position={offset} scale={scale}>
        <primitive object={model} />
      </group>
    </group>
  );
}
