/**
 * Scientific lunar globe.
 *
 * The sphere is a neutral shaded body (mean radius R = 1737.4 km, matching the
 * Horizons coord@301 shape model).  No photographic/procedural texture is drawn
 * on the surface: measured relief is shown only where real DEM data exists, via
 * {@link TerrainPatch}.  Overlaid geometry is entirely data-driven:
 *  - 30° lat/lon graticule, equator, prime meridian, poles;
 *  - candidate/site markers at their true selenographic coordinates;
 *  - Sun and Earth direction arrows from real JPL Horizons ephemeris vectors;
 *  - optional sub-solar / sub-Earth surface points.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";

import type { Site } from "@/lib/api";
import { bfToScene, bfFromLatLon, type Vec3 } from "@/three/coords";

const RADIUS = 1;

function toVec3(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(v[0], v[1], v[2]);
}

/**
 * A polyline drawn with an explicit three.js object.
 *
 * The JSX `<line>` intrinsic name collides with the DOM/SVG `line` element in
 * TypeScript, so we construct the `THREE.Line` ourselves and mount it with
 * `<primitive>`.  The object is memoised so the geometry/material are stable
 * across renders.
 */
function SurfaceLine({
  points,
  color,
  opacity = 1,
}: {
  points: THREE.Vector3[];
  color: string;
  opacity?: number;
}) {
  const object = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
    return new THREE.Line(geometry, material);
  }, [points, color, opacity]);
  return <primitive object={object} />;
}

/** Latitude/longitude graticule as line segments. */
function buildGraticule(stepDeg = 30, radius = RADIUS * 1.001): THREE.BufferGeometry {
  const pts: number[] = [];
  const push = (latDeg: number, lonDeg: number) => {
    const p = bfToScene(bfFromLatLon(latDeg, lonDeg));
    pts.push(p[0] * radius, p[1] * radius, p[2] * radius);
  };

  // Parallels
  for (let lat = -60; lat <= 60; lat += stepDeg) {
    for (let lon = -180; lon < 180; lon += 3) {
      push(lat, lon);
      push(lat, lon + 3);
    }
  }
  // Meridians
  for (let lon = -180; lon < 180; lon += stepDeg) {
    for (let lat = -90; lat < 90; lat += 3) {
      push(lat, lon);
      push(lat + 3, lon);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

/** A circle on the surface at a fixed latitude. */
function LatitudeCircle({
  latDeg,
  color,
  radius = RADIUS * 1.002,
}: {
  latDeg: number;
  color: string;
  radius?: number;
}) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let lon = -180; lon <= 180; lon += 2) {
      const p = bfToScene(bfFromLatLon(latDeg, lon));
      pts.push(new THREE.Vector3(p[0] * radius, p[1] * radius, p[2] * radius));
    }
    return pts;
  }, [latDeg, radius]);
  return <SurfaceLine points={points} color={color} />;
}

/** A half-circle along a fixed longitude (pole to pole). */
function Meridian({
  lonDeg,
  color,
  radius = RADIUS * 1.002,
}: {
  lonDeg: number;
  color: string;
  radius?: number;
}) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let lat = -90; lat <= 90; lat += 2) {
      const p = bfToScene(bfFromLatLon(lat, lonDeg));
      pts.push(new THREE.Vector3(p[0] * radius, p[1] * radius, p[2] * radius));
    }
    return pts;
  }, [lonDeg, radius]);
  return <SurfaceLine points={points} color={color} />;
}

function DirectionArrow({
  direction,
  color,
  label,
  length = 1.7,
}: {
  direction: Vec3;
  color: string;
  label: string;
  length?: number;
}) {
  const { points, tip, labelPos } = useMemo(() => {
    const end = new THREE.Vector3(direction[0], direction[1], direction[2])
      .normalize()
      .multiplyScalar(length);
    return {
      points: [new THREE.Vector3(0, 0, 0), end.clone()],
      tip: end,
      labelPos: end.clone().add(new THREE.Vector3(0, 0.09, 0)),
    };
  }, [direction, length]);

  return (
    <group>
      <SurfaceLine points={points} color={color} />
      <mesh position={tip}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={tip.clone().multiplyScalar(0.86)}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Text
        position={labelPos}
        fontSize={0.08}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}

export interface LunarGlobeProps {
  sites: Site[];
  selectedSlug?: string | null;
  onSelect?: (slug: string) => void;
  sunScene?: Vec3 | null;
  earthScene?: Vec3 | null;
  subsolarLatLon?: [number, number] | null;
  subearthLatLon?: [number, number] | null;
  showGraticule?: boolean;
  showBodies?: boolean;
}

export function LunarGlobe({
  sites,
  selectedSlug,
  onSelect,
  sunScene,
  earthScene,
  subsolarLatLon,
  subearthLatLon,
  showGraticule = true,
  showBodies = true,
}: LunarGlobeProps) {
  const graticule = useMemo(() => buildGraticule(), []);

  return (
    <group>
      {/* Neutral scientific body — no fabricated surface texture. */}
      <mesh>
        <sphereGeometry args={[RADIUS, 96, 96]} />
        <meshStandardMaterial
          color="#243449"
          roughness={0.95}
          metalness={0.05}
          emissive="#0B1930"
          emissiveIntensity={0.35}
        />
      </mesh>

      {showGraticule ? (
        <>
          <lineSegments geometry={graticule}>
            <lineBasicMaterial color="#2A4270" transparent opacity={0.5} />
          </lineSegments>
          <LatitudeCircle latDeg={0} color="#3E5A8A" />
          <Meridian lonDeg={0} color="#3E5A8A" />
          <LatitudeCircle latDeg={-85.4} color="#2F4A78" radius={RADIUS * 1.003} />
          <LatitudeCircle latDeg={-86.8} color="#2F4A78" radius={RADIUS * 1.003} />
        </>
      ) : null}

      {/* Poles */}
      <mesh position={[0, RADIUS, 0]}>
        <sphereGeometry args={[0.02, 12, 12]} />
        <meshBasicMaterial color="#C9D0D8" />
      </mesh>
      <mesh position={[0, -RADIUS, 0]}>
        <sphereGeometry args={[0.02, 12, 12]} />
        <meshBasicMaterial color="#C9D0D8" />
      </mesh>

      {/* Sites */}
      {sites.map((s) => {
        const p = toVec3(bfToScene(bfFromLatLon(s.latitude, s.longitude))).multiplyScalar(
          RADIUS * 1.01,
        );
        const active = s.slug === selectedSlug;
        return (
          <group key={s.slug} position={p}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(s.slug);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "auto";
              }}
            >
              <sphereGeometry args={[active ? 0.026 : 0.016, 16, 16]} />
              <meshBasicMaterial color={active ? "#D5B77A" : "#7FB0E0"} />
            </mesh>
            {active ? (
              <>
                <mesh>
                  <ringGeometry args={[0.036, 0.046, 32]} />
                  <meshBasicMaterial color="#D5B77A" side={THREE.DoubleSide} transparent opacity={0.85} />
                </mesh>
                <mesh scale={[1, 1, 1]} position={[0, 0.001, 0]}>
                  <sphereGeometry args={[0.026, 12, 12]} />
                  <meshBasicMaterial color="#D5B77A" transparent opacity={0.25} />
                </mesh>
              </>
            ) : null}
          </group>
        );
      })}

      {/* Sub-solar / sub-Earth points */}
      {subsolarLatLon ? (
        <mesh
          position={toVec3(bfToScene(bfFromLatLon(subsolarLatLon[0], subsolarLatLon[1]))).multiplyScalar(
            RADIUS * 1.012,
          )}
        >
          <sphereGeometry args={[0.03, 16, 16]} />
          <meshBasicMaterial color="#FFD97A" />
        </mesh>
      ) : null}
      {subearthLatLon ? (
        <mesh
          position={toVec3(bfToScene(bfFromLatLon(subearthLatLon[0], subearthLatLon[1]))).multiplyScalar(
            RADIUS * 1.012,
          )}
        >
          <sphereGeometry args={[0.028, 16, 16]} />
          <meshBasicMaterial color="#6FA8DC" />
        </mesh>
      ) : null}

      {showBodies && sunScene ? (
        <DirectionArrow direction={sunScene} color="#D5B77A" label="Sun" />
      ) : null}
      {showBodies && earthScene ? (
        <DirectionArrow direction={earthScene} color="#6FA8DC" label="Earth" />
      ) : null}
    </group>
  );
}
