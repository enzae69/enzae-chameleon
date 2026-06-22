import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "../store/gameStore";
import Arena from "./Arena";
import RemotePlayers from "./RemotePlayers";
import LocalController from "./LocalController";
import Shots from "./Shots";

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
          top: { value: new THREE.Color("#6f7e8c") },
          mid: { value: new THREE.Color("#aab6c0") },
          bottom: { value: new THREE.Color("#d7dde2") },
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
      <color attach="background" args={["#d7dde2"]} />
      <fog attach="fog" args={["#cfd6dc", 80, 230]} />

      <SkyDome />

      {/* Cool, even facility lighting. */}
      <hemisphereLight args={["#dfe8f0", "#5b626a", 0.85]} />
      <ambientLight intensity={0.3} />
      <directionalLight
        castShadow
        position={SUN.toArray()}
        intensity={2.2}
        color="#eaf1f7"
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-camera-left={-46}
        shadow-camera-right={46}
        shadow-camera-top={46}
        shadow-camera-bottom={-46}
      />
      {/* Cool fill from the opposite side. */}
      <directionalLight position={[-26, 16, -20]} intensity={0.4} color="#bcd0e0" />

      <Arena seed={seed} />
      <RemotePlayers />
      <LocalController />
      <Shots />
    </Canvas>
  );
}
