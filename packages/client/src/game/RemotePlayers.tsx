import { useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { PLAYER_RADIUS, PLAYER_HEIGHT } from "@enzae/shared";
import { live } from "../net/live";
import { useGame } from "../store/gameStore";
import { PropMesh } from "./Prop";
import Blaster from "./Blaster";

const BODY_LEN = PLAYER_HEIGHT - 2 * PLAYER_RADIUS;

interface Disguise {
  kind: string;
  sx: number;
  sy: number;
  sz: number;
}

function RemotePlayer({
  id,
  label,
  team,
  hideName,
}: {
  id: string;
  label: string;
  team: string;
  hideName: boolean;
}) {
  const group = useRef<THREE.Group>(null!);
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  const init = useRef(false);
  const lastKind = useRef("");
  const [disguise, setDisguise] = useState<Disguise | null>(null);

  useFrame((_, dt) => {
    const snap = live.players.get(id);
    const g = group.current;
    if (!snap || !g) return;

    if (!init.current) {
      g.position.set(snap.x, 0, snap.z);
      g.rotation.y = snap.rotationY;
      init.current = true;
    }
    const k = Math.min(1, dt * 12);
    g.position.x += (snap.x - g.position.x) * k;
    g.position.z += (snap.z - g.position.z) * k;

    let d = snap.rotationY - g.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    g.rotation.y += d * Math.min(1, dt * 10);

    // Swap geometry only when the disguise actually changes (avoids re-render churn).
    if (snap.disguiseKind !== lastKind.current) {
      lastKind.current = snap.disguiseKind;
      setDisguise(
        snap.disguiseKind
          ? { kind: snap.disguiseKind, sx: snap.disguiseSx, sy: snap.disguiseSy, sz: snap.disguiseSz }
          : null
      );
    }

    if (mat.current) {
      mat.current.color.set(snap.color);
      mat.current.transparent = snap.isEliminated;
      mat.current.opacity = snap.isEliminated ? 0.2 : 1;
    }
  });

  // Seeker aims the laser by tapping a suspect.
  const fireLaser = (e: ThreeEvent<PointerEvent>) => {
    const gs = useGame.getState();
    const self = gs.roster.find((r) => r.sessionId === gs.selfId);
    if (gs.phase !== "hunting" || self?.team !== "seeker" || self?.isEliminated) return;
    if (Date.now() < gs.laserCdUntil) return; // laser still recharging
    e.stopPropagation();
    gs.shoot("laser", id);
  };

  return (
    <group ref={group}>
      {disguise ? (
        <PropMesh
          ref={mat}
          kind={disguise.kind}
          sx={disguise.sx}
          sy={disguise.sy}
          sz={disguise.sz}
          onPointerDown={fireLaser}
        />
      ) : (
        <>
          <mesh position={[0, PLAYER_HEIGHT / 2, 0]} castShadow onPointerDown={fireLaser}>
            <capsuleGeometry args={[PLAYER_RADIUS, BODY_LEN, 4, 12]} />
            <meshStandardMaterial ref={mat} roughness={0.6} />
          </mesh>
          <mesh position={[0, PLAYER_HEIGHT * 0.62, PLAYER_RADIUS]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color="#0a0a0a" />
          </mesh>
          {team === "seeker" && <Blaster />}
        </>
      )}

      {/* Hide the floating name when disguised, or entirely for the seeker. */}
      {!disguise && !hideName && (
        <Html
          position={[0, PLAYER_HEIGHT + 0.5, 0]}
          center
          distanceFactor={14}
          style={{ pointerEvents: "none" }}
        >
          <div
            className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white ${
              team === "seeker" ? "bg-red-600/80" : "bg-black/50"
            }`}
          >
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

export default function RemotePlayers() {
  const roster = useGame((s) => s.roster);
  const selfId = useGame((s) => s.selfId);
  // Seekers get no name tags — they have to actually spot the hiders.
  const selfIsSeeker = roster.find((r) => r.sessionId === selfId)?.team === "seeker";
  return (
    <>
      {roster
        .filter((r) => r.sessionId !== selfId)
        .map((r) => (
          <RemotePlayer
            key={r.sessionId}
            id={r.sessionId}
            label={`${r.name} · ${r.level}`}
            team={r.team}
            hideName={selfIsSeeker}
          />
        ))}
    </>
  );
}
