/**
 * Local observer scene.
 *
 * Draws, around an observer standing on the measured terrain:
 *  - the real DEM terrain patch (see {@link TerrainPatch});
 *  - the geometric horizon plane (elevation 0°) and the terrain skyline
 *    silhouette derived from `GET /api/terrain/horizon/`;
 *  - the Sun and Earth at their real apparent azimuth/elevation from JPL
 *    Horizons;
 *  - N/E/S/W compass labels (azimuth clockwise from North).
 *
 * Local view frame: +X = East, +Y = Up, -Z = North.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";

import type { HorizonProfile, TerrainMesh } from "@/lib/api";
import { azimuthCompass, azElToLocalView } from "@/three/coords";
import { TerrainPatch, computeTerrainScale } from "@/three/TerrainPatch";

export interface ObserverSceneProps {
  mesh: TerrainMesh | null;
  horizon: HorizonProfile | null;
  observerHeightM: number;
  sun?: { azimuth_deg: number | null; elevation_deg: number | null } | null;
  earth?: { azimuth_deg: number | null; elevation_deg: number | null } | null;
  showTerrain?: boolean;
  showHorizonSilhouette?: boolean;
}

const DISPLAY_SIZE = 2;
const RELIEF_FRACTION = 0.22;
const SKY_RADIUS = 2.6;

const COMPASS_POINTS: { label: string; az: number }[] = [
  { label: "N", az: 0 },
  { label: "E", az: 90 },
  { label: "S", az: 180 },
  { label: "W", az: 270 },
];

function BodyMarker({
  az,
  el,
  color,
  label,
}: {
  az: number | null;
  el: number | null;
  color: string;
  label: string;
}) {
  if (az === null || el === null) return null;
  const p = azElToLocalView(az, el, SKY_RADIUS);
  const below = el < 0;
  return (
    <group>
      <line>
        <bufferGeometry
          {...{
            attributes: {
              position: new THREE.Float32BufferAttribute([0, 0.02, 0, p[0], p[1], p[2]], 3),
            },
          }}
        />
        <lineBasicMaterial color={color} transparent opacity={below ? 0.3 : 0.75} />
      </line>
      <mesh position={p}>
        <sphereGeometry args={[label === "Sun" ? 0.075 : 0.065, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={below ? 0.35 : 1} />
      </mesh>
      <Text
        position={[p[0], p[1] + 0.16, p[2]]}
        fontSize={0.1}
        color={color}
        anchorX="center"
        anchorY="bottom"
      >
        {`${label} ${el.toFixed(1)}°`}
      </Text>
    </group>
  );
}

/** Terrain skyline silhouette: a closed polyline around the observer. */
function HorizonSilhouette({ horizon }: { horizon: HorizonProfile }) {
  const geometry = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (const p of horizon.profile) {
      const v = azElToLocalView(p.azimuth_deg, p.horizon_elevation_deg, SKY_RADIUS * 0.98);
      pts.push(new THREE.Vector3(v[0], v[1], v[2]));
    }
    if (pts.length) pts.push(pts[0].clone());
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [horizon]);

  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color="#8AA0BC" />
    </line>
  );
}

/** Geometric horizon plane at elevation 0°. */
function GeometricHorizon() {
  const geometry = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let az = 0; az <= 360; az += 3) {
      const v = azElToLocalView(az, 0, SKY_RADIUS * 0.98);
      pts.push(new THREE.Vector3(v[0], v[1], v[2]));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color="#1B2C49" />
    </line>
  );
}

export function ObserverScene({
  mesh,
  horizon,
  observerHeightM,
  sun,
  earth,
  showTerrain = true,
  showHorizonSilhouette = true,
}: ObserverSceneProps) {
  const scale = mesh ? computeTerrainScale(mesh, DISPLAY_SIZE, RELIEF_FRACTION) : null;
  const observerY = 0.03;

  return (
    <group>
      {/* Ground markings */}
      <GeometricHorizon />
      {showHorizonSilhouette && horizon ? <HorizonSilhouette horizon={horizon} /> : null}

      {/* Compass */}
      {COMPASS_POINTS.map((c) => {
        const p = azElToLocalView(c.az, 0, SKY_RADIUS * 0.99);
        return (
          <Text
            key={c.label}
            position={[p[0], p[1] + 0.12, p[2]]}
            fontSize={0.13}
            color={c.label === "N" ? "#D5B77A" : "#98A5B5"}
            anchorX="center"
            anchorY="middle"
          >
            {c.label}
          </Text>
        );
      })}

      {/* Real measured terrain */}
      {showTerrain && mesh ? (
        <group position={[0, observerY, 0]}>
          <TerrainPatch mesh={mesh} displaySize={DISPLAY_SIZE} reliefFraction={RELIEF_FRACTION} />
        </group>
      ) : null}

      {/* Observer (lander) marker */}
      <group position={[0, observerY, 0]}>
        <mesh>
          <cylinderGeometry args={[0.03, 0.05, 0.07, 16]} />
          <meshStandardMaterial color="#D5B77A" emissive="#D5B77A" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0, 0.09, 0]}>
          <sphereGeometry args={[0.022, 16, 16]} />
          <meshBasicMaterial color="#F4F6F8" />
        </mesh>
        <Text position={[0, 0.17, 0]} fontSize={0.09} color="#F4F6F8" anchorX="center">
          {`Observer +${observerHeightM.toFixed(1)} m`}
        </Text>
      </group>

      {/* Sky bodies */}
      <BodyMarker az={sun?.azimuth_deg ?? null} el={sun?.elevation_deg ?? null} color="#D5B77A" label="Sun" />
      <BodyMarker
        az={earth?.azimuth_deg ?? null}
        el={earth?.elevation_deg ?? null}
        color="#6FA8DC"
        label="Earth"
      />

      {/* Azimuth readout for the Sun helps orientation */}
      {sun?.azimuth_deg != null ? (
        <Text position={[0, observerY + 0.3, 0]} fontSize={0.075} color="#98A5B5" anchorX="center">
          {`Sun az ${sun.azimuth_deg.toFixed(1)}° (${azimuthCompass(sun.azimuth_deg)})`}
        </Text>
      ) : null}

      {/* Keep a stable, non-clipping ground reference */}
      {scale ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
          <ringGeometry args={[DISPLAY_SIZE * 0.72, DISPLAY_SIZE * 0.74, 64]} />
          <meshBasicMaterial color="#1B2C49" side={THREE.DoubleSide} />
        </mesh>
      ) : null}
    </group>
  );
}
