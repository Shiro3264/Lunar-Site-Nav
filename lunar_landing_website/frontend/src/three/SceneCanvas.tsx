/**
 * Shared react-three-fiber canvas with the LunaNav lighting/starfield rig.
 */
import type { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";

export interface SceneCanvasProps {
  children: ReactNode;
  cameraPosition?: [number, number, number];
  fov?: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  minDistance?: number;
  maxDistance?: number;
  className?: string;
  stars?: boolean;
  onPointerMissed?: () => void;
}

export function SceneCanvas({
  children,
  cameraPosition = [0, 1.2, 3.4],
  fov = 45,
  autoRotate = false,
  autoRotateSpeed = 0.6,
  minDistance = 0.6,
  maxDistance = 12,
  className,
  stars = true,
  onPointerMissed,
}: SceneCanvasProps) {
  return (
    <Canvas
      className={className}
      dpr={[1, 2]}
      camera={{ position: cameraPosition, fov, near: 0.01, far: 100 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={onPointerMissed}
    >
      <color attach="background" args={["#050C16"]} />

      <ambientLight intensity={0.35} />
      {/* Key light at a fixed direction: models sunlight, independent of scene rotation. */}
      <directionalLight position={[4, 5, 3]} intensity={1.5} color="#FFF6E0" />
      <directionalLight position={[-4, -2, -3]} intensity={0.25} color="#6FA8DC" />
      <hemisphereLight args={["#243449", "#07111F", 0.4]} />

      {stars ? (
        <Stars radius={40} depth={25} count={1400} factor={2.4} saturation={0} fade speed={0.4} />
      ) : null}

      {children}

      <OrbitControls
        enablePan={false}
        autoRotate={autoRotate}
        autoRotateSpeed={autoRotateSpeed}
        minDistance={minDistance}
        maxDistance={maxDistance}
        target={new THREE.Vector3(0, 0, 0)}
      />
    </Canvas>
  );
}
