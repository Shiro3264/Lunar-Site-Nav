/**
 * Tests for src/lib/format.ts and AppContext time utilities
 */
import { describe, it, expect } from "vitest";
import { utcHourString, formatUtc } from "@/state/AppContext";

describe("utcHourString", () => {
    it("formats a UTC date as YYYY-MM-DD HH:MM", () => {
        const d = new Date(Date.UTC(2026, 10, 15, 3, 0, 0)); // Nov 15 2026 03:00 UTC
        expect(utcHourString(d)).toBe("2026-11-15 03:00");
    });

    it("pads single-digit month and day", () => {
        const d = new Date(Date.UTC(2026, 0, 5, 0, 0, 0)); // Jan 5
        expect(utcHourString(d)).toBe("2026-01-05 00:00");
    });

    it("floors to the hour (minutes ignored)", () => {
        const d = new Date(Date.UTC(2026, 10, 15, 14, 45, 30));
        expect(utcHourString(d)).toBe("2026-11-15 14:00");
    });

    it("formatUtc produces same result as utcHourString", () => {
        const d = new Date(Date.UTC(2026, 10, 15, 8, 0, 0));
        expect(formatUtc(d)).toBe(utcHourString(d));
    });
});
