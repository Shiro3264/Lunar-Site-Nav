/**
 * Tests for src/three/coords.ts
 *
 * Mirrors the backend scientific_engine/coordinates.py tests so both ends
 * of the coordinate pipeline are verified against the same control points.
 */
import { describe, it, expect } from "vitest";
import {
    bfFromLatLon,
    bfToScene,
    sceneToBf,
    azElToEnu,
    azElToLocalView,
    azimuthCompass,
    enuToBodyfixed,
    matMulVec,
    matMul,
    sceneMatrixFromBodyfixedToInertial,
    deg2rad,
    type Vec3,
} from "@/three/coords";

// -------------------------------------------------------------------------
// Control points (same as backend test)
// -------------------------------------------------------------------------
const CONTROL_POINTS: Array<[string, number, number]> = [
    ["mons_mouton", -85.4, 31.7],
    ["malapert_massif", -86.0, -0.2],
    ["north_pole", 90.0, 0.0],
    ["equator_prime_meridian", 0.0, 0.0],
    ["equator_90e", 0.0, 90.0],
    ["south_pole", -90.0, 0.0],
    ["nobile_rim_1", -85.4, 37.3],
    ["haworth", -86.8, -22.8],
];

function norm(v: Vec3): number {
    return Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
}

// -------------------------------------------------------------------------
// bfFromLatLon produces a unit vector
// -------------------------------------------------------------------------
describe("bfFromLatLon", () => {
    it.each(CONTROL_POINTS)("unit vector for %s", (_name, lat, lon) => {
        const v = bfFromLatLon(lat, lon);
        expect(norm(v)).toBeCloseTo(1.0, 10);
    });

    it("north pole maps to (0, 0, 1)", () => {
        const v = bfFromLatLon(90.0, 0.0);
        expect(v[0]).toBeCloseTo(0, 10);
        expect(v[1]).toBeCloseTo(0, 10);
        expect(v[2]).toBeCloseTo(1, 10);
    });

    it("equator/prime-meridian maps to (1, 0, 0)", () => {
        const v = bfFromLatLon(0.0, 0.0);
        expect(v[0]).toBeCloseTo(1, 10);
        expect(v[1]).toBeCloseTo(0, 10);
        expect(v[2]).toBeCloseTo(0, 10);
    });

    it("equator/90°E maps to (0, 1, 0)", () => {
        const v = bfFromLatLon(0.0, 90.0);
        expect(v[0]).toBeCloseTo(0, 10);
        expect(v[1]).toBeCloseTo(1, 10);
        expect(v[2]).toBeCloseTo(0, 10);
    });

    it("south-pole candidates have negative z-component", () => {
        for (const [, lat, lon] of CONTROL_POINTS) {
            if (lat < -80) {
                const v = bfFromLatLon(lat, lon);
                expect(v[2]).toBeLessThan(0);
            }
        }
    });
});

// -------------------------------------------------------------------------
// bfToScene / sceneToBf round-trip
// -------------------------------------------------------------------------
describe("bfToScene / sceneToBf", () => {
    it("round-trip is identity", () => {
        const bf: Vec3 = [0.3, -0.5, 0.8];
        const rt = sceneToBf(bfToScene(bf));
        for (let i = 0; i < 3; i++) expect(rt[i]).toBeCloseTo(bf[i], 10);
    });

    it("north pole (0,0,1) -> scene (0,1,0) [Y-up]", () => {
        const scene = bfToScene([0, 0, 1]);
        // scene = (bf.y, bf.z, bf.x) => (0, 1, 0)
        expect(scene[0]).toBeCloseTo(0, 10);
        expect(scene[1]).toBeCloseTo(1, 10);
        expect(scene[2]).toBeCloseTo(0, 10);
    });
});

// -------------------------------------------------------------------------
// azElToEnu — always a unit vector
// -------------------------------------------------------------------------
describe("azElToEnu", () => {
    const cases: [number, number][] = [
        [0, 90],   // zenith
        [90, 0],   // East horizon
        [0, 0],    // North horizon
        [180, 0],  // South horizon
        [45, 45],  // NE, 45° up
    ];

    it.each(cases)("az=%f el=%f is unit vector", (az, el) => {
        const v = azElToEnu(az, el);
        expect(norm(v)).toBeCloseTo(1.0, 10);
    });

    it("zenith maps to (0,0,1) in ENU", () => {
        const v = azElToEnu(0.0, 90.0);
        expect(v[0]).toBeCloseTo(0, 10);
        expect(v[1]).toBeCloseTo(0, 10);
        expect(v[2]).toBeCloseTo(1, 10);
    });

    it("due East horizon maps to (1,0,0) in ENU", () => {
        const v = azElToEnu(90.0, 0.0);
        expect(v[0]).toBeCloseTo(1, 10);
        expect(v[1]).toBeCloseTo(0, 10);
        expect(v[2]).toBeCloseTo(0, 10);
    });
});

// -------------------------------------------------------------------------
// azElToLocalView
// -------------------------------------------------------------------------
describe("azElToLocalView", () => {
    it("produces a vector at the requested distance", () => {
        const v = azElToLocalView(90.0, 0.0, 2.6);
        const d = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
        expect(d).toBeCloseTo(2.6, 6);
    });

    it("zenith is +Y in view frame", () => {
        const v = azElToLocalView(0.0, 90.0, 1.0);
        expect(v[0]).toBeCloseTo(0, 8);
        expect(v[1]).toBeCloseTo(1, 8);
        expect(v[2]).toBeCloseTo(0, 8);
    });

    it("North horizon is -Z in view frame", () => {
        const v = azElToLocalView(0.0, 0.0, 1.0);
        expect(v[0]).toBeCloseTo(0, 8);
        expect(v[1]).toBeCloseTo(0, 8);
        expect(v[2]).toBeCloseTo(-1, 8);
    });
});

// -------------------------------------------------------------------------
// azimuthCompass
// -------------------------------------------------------------------------
describe("azimuthCompass", () => {
    it("0° is N", () => expect(azimuthCompass(0)).toBe("N"));
    it("90° is E", () => expect(azimuthCompass(90)).toBe("E"));
    it("180° is S", () => expect(azimuthCompass(180)).toBe("S"));
    it("270° is W", () => expect(azimuthCompass(270)).toBe("W"));
    it("360° wraps to N", () => expect(azimuthCompass(360)).toBe("N"));
    it("45° is NE", () => expect(azimuthCompass(45)).toBe("NE"));
});

// -------------------------------------------------------------------------
// matMulVec / matMul — 3×3 identity
// -------------------------------------------------------------------------
describe("matrix helpers", () => {
    const I3: number[][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

    it("matMulVec with identity is passthrough", () => {
        const v: Vec3 = [1, 2, 3];
        const result = matMulVec(I3, v);
        for (let i = 0; i < 3; i++) expect(result[i]).toBeCloseTo(v[i], 10);
    });

    it("matMul(I,I) = I", () => {
        const result = matMul(I3, I3);
        for (let i = 0; i < 3; i++)
            for (let j = 0; j < 3; j++)
                expect(result[i][j]).toBeCloseTo(I3[i][j], 10);
    });
});

// -------------------------------------------------------------------------
// sceneMatrixFromBodyfixedToInertial — similarity transform sanity
// -------------------------------------------------------------------------
describe("sceneMatrixFromBodyfixedToInertial", () => {
    it("identity bf->inertial gives identity scene matrix", () => {
        const I3: number[][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        const scene = sceneMatrixFromBodyfixedToInertial(I3);
        // S · I · S^T = S · S^T = I (orthogonal S)
        for (let i = 0; i < 3; i++)
            for (let j = 0; j < 3; j++) {
                const expected = i === j ? 1.0 : 0.0;
                expect(scene[i][j]).toBeCloseTo(expected, 10);
            }
    });
});
