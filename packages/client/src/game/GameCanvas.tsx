import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "../store/gameStore";
import Arena from "./Arena";
import RemotePlayers from "./RemotePlayers";
import LocalController from "./LocalController";

const SUN = new THREE.Vector3(34, 46, 24);

/** Vertical gradient sky dome (cheap, no external HDRI). */
function SkyDome() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color("#4f93d6") },
          mid: { value: new THREE.Color("#9fc6e8") },
          bottom: { value: new THREE.Color("#dcebf2") },
        },
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vDir;
          uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
          void main() {
            float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
            vec3 c = h < 0.5
              ? mix(bottom, mid, smoothstep(0.0, 0.5, h))
              : mix(mid, top, smoothstep(0.5, 1.0, h));
            gl_FragColor = vec4(c, 1.0);
          }
        `,
      }),
    []
  );
  return (
    <mesh scale={600} frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[1, 32, 16]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

export default function GameCanvas() {
  const seed = useGame((s) => s.mapSeed);

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 12, 16], fov: 55, near: 0.2, far: 1000 }}
      gl={{ antialias: true, powerPreference: "high-performance", toneMappingExposure: 1.05 }}
    >
      <color attach="background" args={["#dcebf2"]} />
      <fog attach="fog" args={["#d4e6f1", 55, 165]} />

      <SkyDome />

      <hemisphereLight args={["#cfe4ff", "#5a6b46", 0.7]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        castShadow
        position={SUN.toArray()}
        intensity={2.6}
        color="#fff4dc"
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
      />
      {/* Soft warm bounce from the opposite side. */}
      <directionalLight position={[-20, 14, -16]} intensity={0.35} color="#ffd9a8" />

      <Arena seed={seed} />
      <RemotePlayers />
      <LocalController />
    </Canvas>
  );
}
