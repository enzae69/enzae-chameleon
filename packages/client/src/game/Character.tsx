import { useLayoutEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import { PLAYER_HEIGHT } from "@enzae/shared";

const MODEL_URL = `${import.meta.env.BASE_URL}models/character.glb`;
useGLTF.preload(MODEL_URL);

// Extra yaw if the model's "front" isn't +z. This rig faces +z (forward).
const FACE_Y = 0;

// Bones swung for the procedural walk / idle (names come from the rig).
const LEG_L = "thighL_020";
const LEG_R = "thighR_023";
const SHIN_L = "shinL_021";
const SHIN_R = "shinR_024";
const ARM_L = "LeftArm_09";
const ARM_R = "RightArm_013";
const FORE_L = "LeftForeArm_010";
const FORE_R = "RightForeArm_014";
const SWUNG = [LEG_L, LEG_R, SHIN_L, SHIN_R, ARM_L, ARM_R, FORE_L, FORE_R];

interface Swing {
  bone: THREE.Bone;
  rest: THREE.Quaternion;
  axis: THREE.Vector3; // world-X expressed in the bone's parent frame (so we swing fwd/back)
}

/**
 * The player character: a clean rigged stickman. It has no baked clips, so we
 * animate its legs/arms procedurally — swinging them forward/back about the
 * world X axis (robust to the rig's bone orientations) based on movement speed.
 * Idle keeps a subtle arm sway so it never looks frozen.
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

  // Per-instance clone (independent skeleton + materials) so each player
  // animates and tints on its own.
  const model = useMemo(() => {
    const c = SkeletonUtils.clone(scene) as THREE.Object3D;
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = false;
        m.frustumCulled = false;
        m.material = (m.material as THREE.Material).clone();
      }
    });
    return c;
  }, [scene]);

  // Auto-fit: scale to PLAYER_HEIGHT, centred on x/z, feet at y=0.
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
  const swings = useRef<Record<string, Swing>>({});
  useLayoutEffect(() => {
    model.updateMatrixWorld(true);
    const matList: THREE.MeshStandardMaterial[] = [];
    const byName = new Map<string, THREE.Bone>();
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) matList.push(m.material as THREE.MeshStandardMaterial);
      const b = o as THREE.Bone;
      if (b.isBone) byName.set(b.name, b);
    });
    mats.current = matList;
    const out: Record<string, Swing> = {};
    for (const name of SWUNG) {
      const bone = byName.get(name);
      if (!bone || !bone.parent) continue;
      const pq = new THREE.Quaternion();
      (bone.parent as THREE.Object3D).getWorldQuaternion(pq);
      out[name] = {
        bone,
        rest: bone.quaternion.clone(),
        axis: new THREE.Vector3(1, 0, 0).applyQuaternion(pq.invert()).normalize(),
      };
    }
    swings.current = out;
  }, [model]);

  const inner = useRef<THREE.Group>(null!);
  const phase = useRef(0);
  const tmpQ = useMemo(() => new THREE.Quaternion(), []);
  const apply = (sw: Swing | undefined, angle: number) => {
    if (!sw) return;
    tmpQ.setFromAxisAngle(sw.axis, angle);
    sw.bone.quaternion.copy(sw.rest).premultiply(tmpQ);
  };

  useFrame((_, dt) => {
    const eliminated = eliminatedRef.current;
    for (const m of mats.current) {
      if (m.color) m.color.set(colorRef.current);
      m.transparent = eliminated;
      m.opacity = eliminated ? 0.25 : 1;
    }
    const sp = Math.min(1, Math.max(0, speedRef.current));
    phase.current += dt * (4 + sp * 6); // quicker stride the faster you move
    const t = phase.current;
    const s = Math.sin(t);
    const sw = swings.current;

    const legAmp = 0.55 * sp;
    const armAmp = 0.4 * sp + 0.06; // keep a little sway at idle so it breathes
    apply(sw[LEG_L], s * legAmp);
    apply(sw[LEG_R], -s * legAmp);
    apply(sw[ARM_L], -s * armAmp);
    apply(sw[ARM_R], s * armAmp);
    apply(sw[SHIN_L], Math.max(0, -s) * 0.8 * sp); // knees bend on the back swing
    apply(sw[SHIN_R], Math.max(0, s) * 0.8 * sp);
    apply(sw[FORE_L], -0.12 - 0.18 * sp); // slight elbow bend
    apply(sw[FORE_R], -0.12 - 0.18 * sp);

    if (inner.current) inner.current.position.y = offset.y + Math.abs(s) * 0.05 * sp;
  });

  return (
    <group rotation={[0, FACE_Y, 0]}>
      <group ref={inner} position={offset} scale={scale}>
        <primitive object={model} />
      </group>
    </group>
  );
}
