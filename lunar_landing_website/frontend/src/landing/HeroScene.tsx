/**
 * Hero 3D scene — the scientific replacement for the prototype's procedural Moon.
 *
 * Upgrades over the original `initHero()`:
 *  - **No procedural lunar texture.** The body is the shared neutral scientific
 *    globe from {@link LunarGlobe}; measured relief is drawn only where real DEM
 *    data exists (via `TerrainPatch` in the observer/navigator views).
 *  - **No arbitrary rotation.** The scene renders the *body-fixed (selenographic)*
 *    frame — the Moon is stationary by definition, exactly like a fixed surface
 *    coordinate system. The Sun/Earth directions and sub-points move with the
 *    real epoch, not with a fake `rotation.y += …` spin.
 *  - **Coordinate-based marker.** The crosshair tracks the *selected* site's true
 *    selenographic position, not a hardcoded lat/lon.
 *  - **Ephemeris-driven Sun & Earth.** Earth's position and the sun's lighting
 *    direction come from JPL Horizons (via the backend), never hardcoded.
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import type { Site } from "@/lib/api";
import { LunarGlobe } from "@/three/LunarGlobe";
import { siteScenePosition, type Vec3 } from "@/three/coords";

export interface HeroSceneProps {
  sites: Site[];
  selectedSlug: string | null;
  onSelect?: (slug: string) => void;
  /** Sun direction in scene axes (unit), from real ephemeris. */
  sunScene: Vec3 | null;
  /** Earth direction in scene axes (unit), from real ephemeris. */
  earthScene: Vec3 | null;
  subsolarLatLon: [number, number] | null;
  subearthLatLon: [number, number] | null;
  showGraticule: boolean;
  /** Selected site coordinates used by the tracked crosshair. */
  markerLatLon: [number, number] | null;
  crosshairRef?: React.RefObject<HTMLDivElement>;
  reducedMotion: boolean;
}

const BODY_RADIUS = 1.9; // matches the prototype's Moon sphere radius
const DISPLAY_SCALE = BODY_RADIUS;

/** Small orbiting rings kept from the original design (decorative, not physical). */
function OrbitRings() {
  const rings = useMemo(() => {
    const make = (rx: number, rz: number, tilt: number, opacity: number) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 160; i++) {
        const a = (i / 160) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * rx, 0, Math.sin(a) * rz));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: 0xd5b77a,
        transparent: true,
        opacity,
      });
      const line = new THREE.Line(geo, mat);
      line.rotation.set(tilt, 0, 0.3);
      return line;
    };
    return [make(2.5, 2.5, 1.2, 0.4), make(2.75, 2.6, 0.9, 0.16)];
  }, []);
  return (
    <>
      {rings.map((r, i) => (
        <primitive key={i} object={r} />
      ))}
    </>
  );
}

/** Slow pointer-parallax camera rig (observer motion — never body rotation). */
function CameraRig({ reduced }: { reduced: boolean }) {
  const { camera } = useThree();
  const pointer = useRef({ x: 0, y: 0 });
  const base = useMemo(() => new THREE.Vector3(0, -2.0, 9.3), []);

  useEffect(() => {
    if (reduced) return;
    const onMove = (e: PointerEvent) => {
      pointer.current.x = e.clientX / window.innerWidth - 0.5;
      pointer.current.y = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced]);

  useFrame(() => {
    const target = reduced
      ? base
      : base
          .clone()
          .add(new THREE.Vector3(pointer.current.x * 1.6, -pointer.current.y * 1.0, 0));
    camera.position.lerp(target, 0.05);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/** Projects the selected site onto the screen and moves the DOM crosshair. */
function SiteTracker({
  latLon,
  crosshairRef,
}: {
  latLon: [number, number] | null;
  crosshairRef?: React.RefObject<HTMLDivElement>;
}) {
  const { camera, size } = useThree();
  const world = useMemo(() => new THREE.Vector3(), []);
  const pos = useMemo(
    () => (latLon ? siteScenePosition(latLon[0], latLon[1], DISPLAY_SCALE * 1.01) : null),
    [latLon],
  );

  useFrame(() => {
    const el = crosshairRef?.current;
    if (!el) return;
    if (!pos) {
      el.style.opacity = "0";
      return;
    }
    world.set(pos[0], pos[1], pos[2]);
    // Marker is visible when its outward normal faces the camera.
    const facing = world.clone().normalize().dot(camera.position.clone().normalize()) > 0.12;
    const projected = world.clone().project(camera);
    const x = (projected.x * 0.5 + 0.5) * size.width;
    const y = (-projected.y * 0.5 + 0.5) * size.height;
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.style.opacity = facing ? "1" : "0";
  });
  return null;
}

function SceneContents({
  sites,
  selectedSlug,
  onSelect,
  sunScene,
  earthScene,
  subsolarLatLon,
  subearthLatLon,
  showGraticule,
  markerLatLon,
  crosshairRef,
  reducedMotion,
}: HeroSceneProps) {
  const sunDir = useMemo(
    () => (sunScene ? new THREE.Vector3(...sunScene).normalize() : null),
    [sunScene],
  );
  const earthDir = useMemo(
    () => (earthScene ? new THREE.Vector3(...earthScene).normalize() : null),
    [earthScene],
  );

  const sunLightPos = useMemo(() => {
    // Fallback lighting direction is documented (not a fabricated measurement):
    // used only when no ephemeris is available, so the globe stays legible.
    const d = sunDir ?? new THREE.Vector3(-0.6, 0.35, 0.72).normalize();
    return d.multiplyScalar(12);
  }, [sunDir]);
  const sunMarkerPos = useMemo(() => sunLightPos.clone().normalize().multiplyScalar(7.5), [sunLightPos]);
  const earthPos = useMemo(
    () => (earthDir ? earthDir.clone().multiplyScalar(6.2) : null),
    [earthDir],
  );

  return (
    <>
      <CameraRig reduced={reducedMotion} />
      <ambientLight intensity={0.55} color="#2a3b5c" />
      <directionalLight position={sunLightPos} intensity={2.1} color="#fff4e0" />

      <group scale={DISPLAY_SCALE}>
        <LunarGlobe
          sites={sites}
          selectedSlug={selectedSlug}
          onSelect={onSelect}
          sunScene={sunScene}
          earthScene={earthScene}
          subsolarLatLon={subsolarLatLon}
          subearthLatLon={subearthLatLon}
          showGraticule={showGraticule}
          showBodies
        />
      </group>
      <OrbitRings />

      {/* Sun marker — positioned along the real ephemeris direction. */}
      <mesh position={sunMarkerPos}>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshBasicMaterial color="#FFF1C9" />
      </mesh>
      <mesh position={sunMarkerPos}>
        <sphereGeometry args={[0.62, 32, 32]} />
        <meshBasicMaterial color="#D5B77A" transparent opacity={0.18} />
      </mesh>

      {/* Earth — positioned along the real ephemeris direction (not a fixed point). */}
      {earthPos ? (
        <group position={earthPos}>
          <mesh>
            <sphereGeometry args={[0.42, 48, 48]} />
            <meshStandardMaterial color="#1d4a7a" roughness={0.8} metalness={0} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.421, 18, 12]} />
            <meshBasicMaterial color="#6FA8DC" wireframe transparent opacity={0.28} />
          </mesh>
        </group>
      ) : null}

      <SiteTracker latLon={markerLatLon} crosshairRef={crosshairRef} />
    </>
  );
}

export function HeroScene(props: HeroSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, -2.0, 9.3], fov: 30, near: 0.1, far: 100 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <Suspense fallback={null}>
        <SceneContents {...props} />
      </Suspense>
    </Canvas>
  );
}
