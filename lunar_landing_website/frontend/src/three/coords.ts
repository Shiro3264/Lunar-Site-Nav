/**
 * Client-side coordinate helpers that mirror the backend conventions exactly.
 *
 * Frames (see backend `scientific_engine/coordinates.py`):
 *  - body-fixed (bf):  +X → 0° meridian at equator, +Y → 90°E, +Z → north pole.
 *  - scene:            Three.js Y-up;  scene = (bf.y, bf.z, bf.x).
 *  - local ENU:        East–North–Up attached to an observer on the surface.
 *
 * Local *view* frame used for the observer/terrain scenes:
 *  - +X = East, +Y = local Up, -Z = North (so North points toward -Z).
 *    Right-handed: East × North = Up.
 *
 * Azimuth is clockwise from North (N=0°, E=90°), matching JPL Horizons.
 */

export type Vec3 = [number, number, number];

export function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

/** Unit body-fixed vector for a selenographic lat/lon (East-positive). */
export function bfFromLatLon(latDeg: number, lonDeg: number): Vec3 {
  const lat = deg2rad(latDeg);
  const lon = deg2rad(lonDeg);
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

/** body-fixed → Three.js scene (Y-up). */
export function bfToScene(v: Vec3): Vec3 {
  return [v[1], v[2], v[0]];
}

/** scene → body-fixed. */
export function sceneToBf(v: Vec3): Vec3 {
  return [v[2], v[0], v[1]];
}

/** Unit scene vector for a site on a globe of the given radius. */
export function siteScenePosition(latDeg: number, lonDeg: number, radius = 1): Vec3 {
  const s = bfToScene(bfFromLatLon(latDeg, lonDeg));
  return [s[0] * radius, s[1] * radius, s[2] * radius];
}

/** Azimuth/elevation (degrees) → local ENU unit vector. */
export function azElToEnu(azDeg: number, elDeg: number): Vec3 {
  const az = deg2rad(azDeg);
  const el = deg2rad(elDeg);
  return [Math.cos(el) * Math.sin(az), Math.cos(el) * Math.cos(az), Math.sin(el)];
}

export function enuToBodyfixed(e: Vec3, latDeg: number, lonDeg: number): Vec3 {
  const lat = deg2rad(latDeg);
  const lon = deg2rad(lonDeg);
  const east: Vec3 = [-Math.sin(lon), Math.cos(lon), 0];
  const north: Vec3 = [
    -Math.sin(lat) * Math.cos(lon),
    -Math.sin(lat) * Math.sin(lon),
    Math.cos(lat),
  ];
  const up: Vec3 = [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ];
  return [
    e[0] * east[0] + e[1] * north[0] + e[2] * up[0],
    e[0] * east[1] + e[1] * north[1] + e[2] * up[1],
    e[0] * east[2] + e[1] * north[2] + e[2] * up[2],
  ];
}

/**
 * Azimuth/elevation → local *view* vector (X=E, Y=Up, -Z=N).
 * This is the frame used to draw the sky dome and terrain around the observer.
 */
export function azElToLocalView(azDeg: number, elDeg: number, distance = 1): Vec3 {
  const az = deg2rad(azDeg);
  const el = deg2rad(elDeg);
  const c = Math.cos(el) * distance;
  return [c * Math.sin(az), Math.sin(el) * distance, -c * Math.cos(az)];
}

/** Little-endian-free matrix multiply: returns R·v. */
export function matMulVec(m: number[][], v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

/** 3×3 matrix multiply (row-major). */
export function matMul(a: number[][], b: number[][]): number[][] {
  const out: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      out[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
  return out;
}

function transpose3(m: number[][]): number[][] {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}

/**
 * Axis permutation that maps body-fixed axes to Three.js scene axes:
 * `scene = S · bodyfixed`, with `S = [[0,1,0],[0,0,1],[1,0,0]]` (see `bfToScene`).
 */
const BF_TO_SCENE_MATRIX: number[][] = [
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 0],
];

/**
 * Re-express a body-fixed → inertial rotation matrix in Three.js scene axes.
 *
 * Similarity transform `R_scene = S · R_bf→inertial · Sᵀ`, so a body-fixed scene
 * object rotated by the result is placed at its true inertial attitude (this is
 * the real orientation engine — there is no arbitrary `rotation.y += …` spin).
 */
export function sceneMatrixFromBodyfixedToInertial(m: number[][]): number[][] {
  const S = BF_TO_SCENE_MATRIX;
  return matMul(matMul(S, m), transpose3(S));
}

export const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export function azimuthCompass(azDeg: number): string {
  const idx = Math.round(((azDeg % 360) + 360) % 360 / 45) % 8;
  return COMPASS[idx];
}

/** Convert grid row/col (row 0 = north edge) into local east/north offsets (km). */
export function gridOffset(
  row: number,
  col: number,
  grid: number,
  sizeKm: number,
): { east: number; north: number } {
  const north = (0.5 - row / (grid - 1)) * sizeKm;
  const east = (col / (grid - 1) - 0.5) * sizeKm;
  return { east, north };
}
