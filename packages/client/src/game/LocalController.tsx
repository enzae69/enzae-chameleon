import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  PLAYER_RADIUS,
  PLAYER_HEIGHT,
  HIDER_SPEED,
  SEEKER_SPEED,
  ARENA_HALF,
  generateBuildings,
  collideBuildings,
} from "@enzae/shared";
import { live } from "../net/live";
import { useGame } from "../store/gameStore";
import { attachKeyboard, getMoveIntent } from "./input";
import { attachCameraInput, resetCamera, camState, CAM } from "./cameraInput";
import { colliders } from "./colliders";
import { PropMesh } from "./Prop";
import Blaster from "./Blaster";

const BODY_LEN = PLAYER_HEIGHT - 2 * PLAYER_RADIUS;
const LIMIT = ARENA_HALF - PLAYER_RADIUS - 0.5;
const SEND_INTERVAL = 1 / 20;
const HEAD_Y = PLAYER_HEIGHT * 0.9; // camera focus / eye height

export default function LocalController() {
  const seed = useGame((s) => s.mapSeed);
  const selfTeam = useGame((s) => s.roster.find((r) => r.sessionId === s.selfId)?.team ?? "hider");
  const buildings = useMemo(() => generateBuildings(seed), [seed]);
  const group = useRef<THREE.Group>(null!);
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  const pos = useRef({ x: 0, z: 0, yaw: 0 });
  const seq = useRef(0);
  const acc = useRef(0);
  const inited = useRef(false);
  const lastKind = useRef("");
  const [disguise, setDisguise] = useState<{ kind: string; sx: number; sy: number; sz: number } | null>(
    null
  );

  // Camera working vectors (reused each frame, no per-frame allocation).
  const ray = useRef(new THREE.Raycaster());
  const target = useRef(new THREE.Vector3());
  const offset = useRef(new THREE.Vector3());
  const camDesired = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());

  const { gl } = useThree();

  useEffect(() => attachKeyboard(), []);
  useEffect(() => {
    resetCamera();
    return attachCameraInput(gl.domElement);
  }, [gl]);

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

    // --- Camera-relative movement -------------------------------------------
    // Input intent is in screen space (up = -z). Rotate it by the camera yaw so
    // "up" always means "away from the camera", like Roblox.
    const intent = frozen ? { x: 0, z: 0 } : getMoveIntent();
    const yaw = camState.yaw;
    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    const fwdAmt = -intent.z; // screen up
    const rightAmt = intent.x; // screen right
    let mx = -sy * fwdAmt + cy * rightAmt;
    let mz = -cy * fwdAmt - sy * rightAmt;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const speed = team === "seeker" ? SEEKER_SPEED : HIDER_SPEED;

    pos.current.x = THREE.MathUtils.clamp(pos.current.x + mx * speed * dt, -LIMIT, LIMIT);
    pos.current.z = THREE.MathUtils.clamp(pos.current.z + mz * speed * dt, -LIMIT, LIMIT);
    if (buildings.length) {
      const c = collideBuildings(pos.current.x, pos.current.z, buildings);
      pos.current.x = c.x;
      pos.current.z = c.z;
    }
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

    // --- Disguise swap (matches RemotePlayers) ------------------------------
    if (self && self.disguiseKind !== lastKind.current) {
      lastKind.current = self.disguiseKind;
      setDisguise(
        self.disguiseKind
          ? { kind: self.disguiseKind, sx: self.disguiseSx, sy: self.disguiseSy, sz: self.disguiseSz }
          : null
      );
    }

    if (mat.current && self) {
      mat.current.color.set(self.color);
      mat.current.transparent = eliminated;
      mat.current.opacity = eliminated ? 0.3 : 1;
    }

    // --- Roblox-style orbit camera ------------------------------------------
    const pitch = camState.pitch;
    target.current.set(pos.current.x, HEAD_Y, pos.current.z);

    // Offset points from the character to the camera (behind it).
    offset.current.set(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch)
    );

    // Wall/building collision: pull the camera in if something blocks the view.
    let dist = camState.distance;
    ray.current.set(target.current, offset.current);
    ray.current.far = dist + 0.5;
    if (colliders.length) {
      const hits = ray.current.intersectObjects(colliders, true);
      if (hits.length && hits[0].distance < dist) {
        dist = Math.max(CAM.MIN_DIST, hits[0].distance - 0.3);
      }
    }

    const firstPerson = camState.distance <= CAM.FP_DIST;
    g.visible = !firstPerson; // hide our own body in first person

    if (firstPerson) {
      camDesired.current.copy(target.current);
      lookAt.current.copy(target.current).addScaledVector(offset.current, -2);
      camera.position.copy(camDesired.current);
    } else {
      camDesired.current.copy(target.current).addScaledVector(offset.current, dist);
      if (camDesired.current.y < 0.4) camDesired.current.y = 0.4; // never under the floor
      lookAt.current.copy(target.current);
      camera.position.lerp(camDesired.current, Math.min(1, dt * 12));
    }
    camera.lookAt(lookAt.current);

    // --- Send input to server ------------------------------------------------
    acc.current += dt;
    if (acc.current >= SEND_INTERVAL) {
      acc.current = 0;
      gs.sendInput({ seq: ++seq.current, moveX: mx, moveZ: mz, rotationY: pos.current.yaw });
    }
  });

  return (
    <group ref={group}>
      {disguise ? (
        <PropMesh ref={mat} kind={disguise.kind} sx={disguise.sx} sy={disguise.sy} sz={disguise.sz} />
      ) : (
        <>
          <mesh position={[0, PLAYER_HEIGHT / 2, 0]} castShadow>
            <capsuleGeometry args={[PLAYER_RADIUS, BODY_LEN, 4, 12]} />
            <meshStandardMaterial ref={mat} />
          </mesh>
          <mesh position={[0, PLAYER_HEIGHT * 0.62, PLAYER_RADIUS]}>
            <sphereGeometry args={[0.13, 8, 8]} />
            <meshStandardMaterial color="#0a0a0a" />
          </mesh>
          {selfTeam === "seeker" && <Blaster />}
        </>
      )}
      {/* Own-player ground ring so you always know where you are. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[PLAYER_RADIUS + 0.15, PLAYER_RADIUS + 0.33, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}
