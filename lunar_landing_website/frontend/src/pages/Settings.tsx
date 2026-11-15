import { useEffect, useState } from "react";
import { Database, RefreshCw, Sliders, Wrench } from "lucide-react";

import { Disclaimer, MetricRow, SectionHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { api, type HealthStatus } from "@/lib/api";
import { BRAND, DISCLAIMER, TIME_PRESETS } from "@/lib/constants";
import { useAsync } from "@/hooks/useAsync";
import { useApp } from "@/state/AppContext";

const STORAGE_KEY = "lunanav.settings.v1";

interface Settings {
  allowSynthetic: boolean;
  observerHeightM: number;
  defaultStep: string;
  autoRotateGlobe: boolean;
  showGraticule: boolean;
  showStarfield: boolean;
}

const DEFAULTS: Settings = {
  allowSynthetic: true,
  observerHeightM: 2.0,
  defaultStep: "1 h",
  autoRotateGlobe: true,
  showGraticule: true,
  showStarfield: true,
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

export default function Settings() {
  const { sites, reloadSites, sitesLoading, window: win, setWindow } = useApp();
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const health = useAsync(() => api.health(), []);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSavedAt(new Date().toLocaleTimeString());
    } catch {
      // storage may be unavailable; settings remain session-only
    }
  }, [settings]);

  const apiBase = import.meta.env.VITE_API_BASE_URL || "/api (Vite dev proxy)";
  const lola = (health.data?.integrations.lola_dem ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Settings"
        subtitle="Runtime, data-source and display preferences for the LunaNav console."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Sliders className="h-4 w-4 text-lunanav-gold" />
            <CardTitle>Analysis preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label className="text-lunanav-silver">Allow synthetic terrain fallback</Label>
                <p className="mt-1 text-[11px] leading-relaxed text-lunanav-muted">
                  When no measured LOLA tile is available, allow a clearly-labelled synthetic relief
                  model so the pipeline still returns a result. Disable to force measured-only data
                  (terrain-aware fields become null instead).
                </p>
              </div>
              <Switch
                checked={settings.allowSynthetic}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, allowSynthetic: v }))}
              />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="obs-height">Observer height (m)</Label>
                <Input
                  id="obs-height"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  className="h-8 text-xs"
                  value={settings.observerHeightM}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, observerHeightM: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="def-step">Default step</Label>
                <Input
                  id="def-step"
                  className="h-8 font-mono text-xs"
                  value={settings.defaultStep}
                  onChange={(e) => setSettings((s) => ({ ...s, defaultStep: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWindow({ step: settings.defaultStep })}
              >
                Apply step to current window
              </Button>
              {TIME_PRESETS.slice(0, 0).map((p) => (
                <Badge key={p.label} variant="muted">
                  {p.label}
                </Badge>
              ))}
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Label className="text-lunanav-silver">Auto-rotate 3D globe</Label>
              <Switch
                checked={settings.autoRotateGlobe}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, autoRotateGlobe: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-lunanav-silver">Show lat/lon graticule</Label>
              <Switch
                checked={settings.showGraticule}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, showGraticule: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-lunanav-silver">Show starfield</Label>
              <Switch
                checked={settings.showStarfield}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, showStarfield: v }))}
              />
            </div>

            <p className="font-mono text-[10px] text-lunanav-muted">
              {savedAt ? `Preferences stored locally at ${savedAt}` : "Preferences stored locally"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Wrench className="h-4 w-4 text-lunanav-gold" />
            <CardTitle>Backend &amp; connection</CardTitle>
          </CardHeader>
          <CardContent>
            <MetricRow label="API base URL" value={apiBase} />
            <MetricRow label="Version" value={health.data?.version ?? "—"} />
            <MetricRow label="Status" value={health.data?.status ?? "—"} />
            <MetricRow
              label="Database"
              value={
                health.data?.database
                  ? `${health.data.database.engine} (${health.data.database.connected ? "connected" : "down"})`
                  : "—"
              }
            />
            <MetricRow
              label="SPICE"
              value={health.data?.integrations.spice.available ? "available" : "fallback"}
            />
            <MetricRow
              label="Loaded kernels"
              value={health.data?.integrations.spice.kernels?.length ?? 0}
            />
            <MetricRow
              label="LOLA DEM"
              value={lola.available ? `available (${lola.tile_count ?? 0} tile(s))` : "unavailable"}
            />
            <MetricRow
              label="Candidate sites"
              value={sitesLoading ? "loading…" : sites.length}
            />
            <MetricRow
              label="Current window"
              value={`${win.start} → ${win.stop} (step ${win.step})`}
            />
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void reloadSites()}>
                <RefreshCw className="h-3.5 w-3.5" /> Reload sites
              </Button>
              <Button variant="outline" size="sm" onClick={health.reload}>
                <RefreshCw className="h-3.5 w-3.5" /> Re-check health
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  localStorage.removeItem(STORAGE_KEY);
                  setSettings(DEFAULTS);
                }}
              >
                Reset preferences
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Database className="h-4 w-4 text-lunanav-gold" />
            <CardTitle>Scientific data sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[11px] leading-relaxed text-lunanav-muted">
            <div className="flex flex-wrap gap-2">
              <Badge variant="muted" className="font-mono">JPL Horizons · OBSERVER QUANTITIES=4</Badge>
              <Badge variant="muted" className="font-mono">NASA LRO LOLA DEM</Badge>
              <Badge variant="muted" className="font-mono">NAIF SPICE · DE440 PCK</Badge>
              <Badge variant="muted" className="font-mono">NASA PDS</Badge>
            </div>
            <p>
              Sun/Earth geometry is fetched live from JPL Horizons for the exact site coordinate
              (<span className="font-mono">CENTER=coord@301, SITE_COORD=lon,lat,alt</span>). Lunar
              body-fixed orientation is computed from NAIF SPICE kernels and includes physical
              libration. Terrain is sampled from NASA LRO LOLA DEM tiles when present locally.
            </p>
            <p style={{ color: BRAND.muted }}>
              Nothing on this platform fabricates measurements: unavailable values are returned as
              null with an explanatory note, and every estimate is explicitly labelled.
            </p>
          </CardContent>
        </Card>
      </div>

      <Disclaimer text={DISCLAIMER} />
    </div>
  );
}
