import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLAYER_RADIUS, PLAYER_HEIGHT, HIDER_SPEED, SEEKER_SPEED, ARENA_HALF } from "@enzae/shared";
import { live } from "../net/live";
import { useGame } from "../store/gameStore";
import { attachKeyboard, getMoveIntent } from "./input";

const BODY_LEN = PLAYER_HEIGHT - 2 * PLAYER_RADIUS;
const LIMIT = ARENA_HALF - PLAYER_RADIUS - 0.5;
const SEND_INTERVAL = 1 / 20;

export default function LocalController() {
  const group = useRef<THREE.Group>(null!);
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  const pos = useRef({ x: 0, z: 0, yaw: 0 });
  const seq = useRef(0);
  const acc = useRef(0);
  const inited = useRef(false);
  const desired = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());

  useEffect(() => attachKeyboard(), []);

  useFrame(({ camera }, dt) => {
    const g = group.current;
    if (!g) return;
    const self = live.players.get(live.selfId);

    if (self && !inited.current) {
      pos.current.x = self.x;
      pos.current.z = self.z;
      pos.current.yaw = self.rotationY;
      inited.current = true;
    }

    const gs = useGame.getState();
    const phase = gs.phase;
    const team = self?.team ?? "hider";
    const eliminated = self?.isEliminated ?? false;
    const isPlayablePhase = phase === "hiding" || phase === "hunting" || phase === "waiting";
    const frozen = eliminated || (phase === "hiding" && team === "seeker") || !isPlayablePhase;

    const intent = frozen ? { x: 0, z: 0 } : getMoveIntent();
    let mx = intent.x;
    let mz = intent.z;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const speed = team === "seeker" ? SEEKER_SPEED : HIDER_SPEED;

    pos.current.x = THREE.MathUtils.clamp(pos.current.x + mx * speed * dt, -LIMIT, LIMIT);
    pos.current.z = THREE.MathUtils.clamp(pos.current.z + mz * speed * dt, -LIMIT, LIMIT);
    if (len > 0.01) pos.current.yaw = Math.atan2(mx, mz);

    // Reconcile with the authoritative server position.
    if (self) {
      const ddx = self.x - pos.current.x;
      const ddz = self.z - pos.current.z;
      if (Math.hypot(ddx, ddz) > 3) {
        pos.current.x = self.x;
        pos.current.z = self.z;
      } else {
        const c = Math.min(1, dt * 3);
        pos.current.x += ddx * c;
        pos.current.z += ddz * c;
      }
    }

    g.position.set(pos.current.x, 0, pos.current.z);
    g.rotation.y = pos.current.yaw;
    live.selfX = pos.current.x;
    live.selfZ = pos.current.z;

    if (mat.current && self) {
      mat.current.color.set(self.color);
      mat.current.transparent = eliminated;
      mat.current.opacity = eliminated ? 0.3 : 1;
    }

    desired.current.set(pos.current.x, 18, pos.current.z + 14);
    camera.position.lerp(desired.current, Math.min(1, dt * 4));
    lookAt.current.set(pos.current.x, 0, pos.current.z);
    camera.lookAt(lookAt.current);

    acc.current += dt;
    if (acc.current >= SEND_INTERVAL) {
      acc.current = 0;
      gs.sendInput({ seq: ++seq.current, moveX: mx, moveZ: mz, rotationY: pos.current.yaw });
    }
  });

  return (
    <group ref={group}>
      <mesh position={[0, PLAYER_HEIGHT / 2, 0]} castShadow>
        <capsuleGeometry args={[PLAYER_RADIUS, BODY_LEN, 4, 12]} />
        <meshStandardMaterial ref={mat} />
      </mesh>
      <mesh position={[0, PLAYER_HEIGHT * 0.62, PLAYER_RADIUS]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[PLAYER_RADIUS + 0.15, PLAYER_RADIUS + 0.33, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}
