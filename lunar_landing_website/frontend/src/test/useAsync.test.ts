/**
 * Tests for src/hooks/useAsync.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAsync } from "@/hooks/useAsync";

describe("useAsync", () => {
    it("starts in loading state", () => {
        const fn = () => new Promise<string>(() => { }); // never resolves
        const { result } = renderHook(() => useAsync(fn, []));
        expect(result.current.loading).toBe(true);
        expect(result.current.data).toBeNull();
        expect(result.current.error).toBeNull();
    });

    it("resolves data on success", async () => {
        const fn = vi.fn().mockResolvedValue({ value: 42 });
        const { result } = renderHook(() => useAsync(fn, []));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.data).toEqual({ value: 42 });
        expect(result.current.error).toBeNull();
    });

    it("captures error message on rejection", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("network error"));
        const { result } = renderHook(() => useAsync(fn, []));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.data).toBeNull();
        expect(result.current.error).toContain("network error");
    });

    it("re-runs when deps change", async () => {
        let counter = 0;
        const fn = vi.fn().mockImplementation(() => Promise.resolve(++counter));

        const { result, rerender } = renderHook(
            ({ dep }) => useAsync(fn, [dep]),
            { initialProps: { dep: 1 } }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.data).toBe(1);

        rerender({ dep: 2 });
        await waitFor(() => expect(result.current.data).toBe(2));
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("does not run when enabled=false", async () => {
        const fn = vi.fn().mockResolvedValue("should not run");
        const { result } = renderHook(() => useAsync(fn, [], { enabled: false }));

        // Give it a tick to prove it stays idle
        await new Promise((r) => setTimeout(r, 50));
        expect(fn).not.toHaveBeenCalled();
        expect(result.current.loading).toBe(false);
    });

    it("reload() re-executes the function", async () => {
        const fn = vi.fn().mockResolvedValue("first");
        const { result } = renderHook(() => useAsync(fn, []));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(fn).toHaveBeenCalledTimes(1);

        fn.mockResolvedValue("second");
        act(() => { result.current.reload(); });

        await waitFor(() => expect(result.current.data).toBe("second"));
        expect(fn).toHaveBeenCalledTimes(2);
    });
});
