/**
 * Global application state: candidate sites, the currently selected site and
 * the analysis time window.  Shared by every page via {@link useApp}.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, type Site } from "@/lib/api";

export interface TimeWindow {
  start: string; // "YYYY-MM-DD HH:MM" (UT)
  stop: string;
  step: string;
}

interface AppState {
  sites: Site[];
  sitesLoading: boolean;
  sitesError: string | null;
  reloadSites: () => Promise<void>;
  selectedSlug: string | null;
  setSelectedSlug: (slug: string | null) => void;
  selectedSite: Site | null;
  window: TimeWindow;
  setWindow: (w: Partial<TimeWindow>) => void;
  shiftWindow: (hours: number) => void;
  resetWindow: () => void;
}

const AppContext = createContext<AppState | null>(null);

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Floor a date to the hour, in UTC, formatted as "YYYY-MM-DD HH:MM". */
export function utcHourString(date: Date): string {
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:00`
  );
}

function parseUtc(s: string): Date {
  const [d, t = "00:00"] = s.split(" ");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, day, hh, mm));
}

export function formatUtc(date: Date): string {
  return utcHourString(date);
}

function defaultWindow(): TimeWindow {
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  const stop = new Date(now.getTime() + 24 * 3600 * 1000);
  return { start: utcHourString(now), stop: utcHourString(stop), step: "1 h" };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [window, setWindowState] = useState<TimeWindow>(() => defaultWindow());

  const reloadSites = useCallback(async () => {
    setSitesLoading(true);
    setSitesError(null);
    try {
      const data = await api.listSites();
      setSites(data.results);
      setSelectedSlug((current) => current ?? data.results[0]?.slug ?? null);
    } catch (err) {
      setSitesError(err instanceof Error ? err.message : String(err));
    } finally {
      setSitesLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadSites();
  }, [reloadSites]);

  const setWindow = useCallback((w: Partial<TimeWindow>) => {
    setWindowState((prev) => ({ ...prev, ...w }));
  }, []);

  const shiftWindow = useCallback((hours: number) => {
    setWindowState((prev) => {
      const start = parseUtc(prev.start);
      const stop = parseUtc(prev.stop);
      const delta = hours * 3600 * 1000;
      return {
        ...prev,
        start: utcHourString(new Date(start.getTime() + delta)),
        stop: utcHourString(new Date(stop.getTime() + delta)),
      };
    });
  }, []);

  const resetWindow = useCallback(() => setWindowState(defaultWindow()), []);

  const selectedSite = useMemo(
    () => sites.find((s) => s.slug === selectedSlug) ?? null,
    [sites, selectedSlug],
  );

  const value: AppState = {
    sites,
    sitesLoading,
    sitesError,
    reloadSites,
    selectedSlug,
    setSelectedSlug,
    selectedSite,
    window,
    setWindow,
    shiftWindow,
    resetWindow,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within an AppProvider.");
  return ctx;
}
