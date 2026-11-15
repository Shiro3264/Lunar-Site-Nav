/**
 * Real measured terrain patch.
 *
 * Renders the local DEM grid returned by `GET /api/terrain/mesh/` (derived from
 * NASA LRO LOLA data).  Heights are genuine elevations; only the *display*
 * vertical exaggeration is synthetic and is reported back to the UI.
 *
 * Local view frame: +X = East, +Y = Up, -Z = North.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";

import type { TerrainMesh } from "@/lib/api";

export interface TerrainPatchProps {
  mesh: TerrainMesh;
  /** Patch width in scene units. */
  displaySize?: number;
  /** Target relief height as a fraction of the patch width. */
  reliefFraction?: number;
  wireframe?: boolean;
}

export interface TerrainScale {
  exaggeration: number;
  kmToUnit: number;
  /** Convert an elevation in metres to a local +Y scene coordinate. */
  heightToUnit: (heightM: number) => number;
}

export function computeTerrainScale(
  mesh: TerrainMesh,
  displaySize: number,
  reliefFraction: number,
): TerrainScale {
  const kmToUnit = displaySize / mesh.size_km;
  const reliefKm = Math.max(1e-6, (mesh.max_m - mesh.min_m) / 1000);
  const naturalUnits = reliefKm * kmToUnit;
  const exaggeration = Math.min(60, Math.max(1, (displaySize * reliefFraction) / naturalUnits));
  const heightToUnit = (h: number) => ((h - mesh.min_m) / 1000) * kmToUnit * exaggeration;
  return { exaggeration, kmToUnit, heightToUnit };
}

function elevationColor(t: number): THREE.Color {
  // low → deep blue-grey, mid → silver, high → gold
  const low = new THREE.Color("#1E3350");
  const mid = new THREE.Color("#5A7699");
  const high = new THREE.Color("#D5B77A");
  return t < 0.5
    ? low.clone().lerp(mid, t / 0.5)
    : mid.clone().lerp(high, (t - 0.5) / 0.5);
}

export function TerrainPatch({
  mesh,
  displaySize = 2,
  reliefFraction = 0.22,
  wireframe = false,
}: TerrainPatchProps) {
  const { geometry } = useMemo(() => {
    const { grid, heights_m, size_km, min_m, max_m } = mesh;
    const scale = computeTerrainScale(mesh, displaySize, reliefFraction);

    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const span = max_m - min_m || 1;

    for (let i = 0; i < grid; i += 1) {
      for (let j = 0; j < grid; j += 1) {
        // Row 0 = north edge; column 0 = west edge.
        const north = (0.5 - i / (grid - 1)) * size_km;
        const east = (j / (grid - 1) - 0.5) * size_km;
        const h = heights_m[i][j];

        positions.push(east * scale.kmToUnit, scale.heightToUnit(h), -north * scale.kmToUnit);

        const c = elevationColor((h - min_m) / span);
        colors.push(c.r, c.g, c.b);
      }
    }

    for (let i = 0; i < grid - 1; i += 1) {
      for (let j = 0; j < grid - 1; j += 1) {
        const a = i * grid + j;
        const b = a + 1;
        const c = a + grid;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return { geometry: geo };
  }, [mesh, displaySize, reliefFraction]);

  const scale = useMemo(
    () => computeTerrainScale(mesh, displaySize, reliefFraction),
    [mesh, displaySize, reliefFraction],
  );

  return (
    <group>
      <mesh geometry={geometry} rotation={[0, 0, 0]}>
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          roughness={0.85}
          metalness={0.05}
          flatShading={false}
          wireframe={wireframe}
        />
      </mesh>
      {/* Observer position height marker line (site centre) */}
      <line>
        <bufferGeometry
          {...{
            attributes: {
              position: new THREE.Float32BufferAttribute(
                [0, 0, 0, 0, scale.heightToUnit(meshHeightsCentre(mesh)), 0],
                3,
              ),
            },
          }}
        />
        <lineBasicMaterial color="#D5B77A" transparent opacity={0.4} />
      </line>
      <Text
        position={[displaySize / 2 - 0.02, 0.06, displaySize / 2 - 0.02]}
        fontSize={0.07}
        color="#98A5B5"
        anchorX="right"
        anchorY="bottom"
      >
        {`×${scale.exaggeration.toFixed(1)} vertical exaggeration`}
      </Text>
    </group>
  );
}

function meshHeightsCentre(mesh: TerrainMesh): number {
  const mid = Math.floor(mesh.grid / 2);
  return mesh.heights_m[mid]?.[mid] ?? mesh.min_m;
}

export { meshHeightsCentre };
