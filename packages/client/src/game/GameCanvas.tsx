import { Canvas } from "@react-three/fiber";
import { useGame } from "../store/gameStore";
import Arena from "./Arena";
import RemotePlayers from "./RemotePlayers";
import LocalController from "./LocalController";

export default function GameCanvas() {
  const seed = useGame((s) => s.mapSeed);

  return (
    <Canvas
      shadows={false}
      dpr={[1, 1.5]}
      camera={{ position: [0, 18, 14], fov: 50, near: 0.1, far: 200 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#0b2018"]} />
      <fog attach="fog" args={["#0b2018", 38, 75]} />
      <hemisphereLight args={["#bfe3c8", "#0a1f16", 0.85]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[14, 26, 10]} intensity={1.1} />
      <Arena seed={seed} />
      <RemotePlayers />
      <LocalController />
    </Canvas>
  );
}
