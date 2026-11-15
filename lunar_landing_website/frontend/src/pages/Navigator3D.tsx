import { useEffect, useMemo, useState } from "react";
import { Globe2, Mountain } from "lucide-react";

import { Disclaimer, ErrorState, LoadingState, MetricRow, SectionHeader } from "@/components/common";
import { TimeControls } from "@/components/layout/TimeControls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { DASH, num } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useApp } from "@/state/AppContext";
import { LunarGlobe } from "@/three/LunarGlobe";
import { ObserverScene } from "@/three/ObserverScene";
import { SceneCanvas } from "@/three/SceneCanvas";
import type { Vec3 } from "@/three/coords";

type ViewMode = "globe" | "local";

export default function Navigator3D() {
  const { sites, selectedSlug, setSelectedSlug, selectedSite, window: win } = useApp();
  const [mode, setMode] = useState<ViewMode>("globe");
  const [sampleIndex, setSampleIndex] = useState(0);

  const timeline = useAsync(
    () =>
      selectedSlug
        ? api.ephemerisTimeline({
            site_slug: selectedSlug,
            start: win.start,
            stop: win.stop,
            step: win.step,
          })
        : Promise.resolve(null),
    [selectedSlug, win.start, win.stop, win.step],
    { enabled: Boolean(selectedSlug) },
  );

  const subPoints = useAsync(
    () => api.subPoints({ start: win.start, stop: win.start, step: win.step }),
    [win.start, win.step],
  );

  const lat = selectedSite?.latitude ?? -85.4;
  const lon = selectedSite?.longitude ?? 31.7;

  const mesh = useAsync(
    () => api.terrainMesh({ latitude: lat, longitude: lon, size_km: 8, grid: 56 }),
    [lat, lon],
    { enabled: mode === "local" },
  );

  const horizon = useAsync(
    () => api.terrainHorizon({ latitude: lat, longitude: lon, azimuths: 72, observer_height_m: 2 }),
    [lat, lon],
    { enabled: mode === "local" },
  );

  const rows = timeline.data?.rows ?? [];
  useEffect(() => {
    if (rows.length && sampleIndex >= rows.length) setSampleIndex(0);
  }, [rows.length, sampleIndex]);

  const row = rows[Math.min(sampleIndex, Math.max(0, rows.length - 1))] ?? null;

  const sunScene = (row?.sun?.direction_scene as Vec3 | null | undefined) ?? null;
  const earthScene = (row?.earth?.direction_scene as Vec3 | null | undefined) ?? null;

  const subsolar = useMemo<[number, number] | null>(
    () => subPoints.data?.subsolar_lat_lon ?? null,
    [subPoints.data],
  );
  const subearth = useMemo<[number, number] | null>(
    () => subPoints.data?.subearth_lat_lon ?? null,
    [subPoints.data],
  );

  return (
    <div className="space-y-4">
      <SectionHeader
        title="3D Lunar Navigator"
        subtitle="Measured terrain, true selenographic coordinates and real ephemeris directions (no procedural surface texture)."
        actions={
          <Tabs value={mode} onValueChange={(v) => setMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="globe" className="gap-1.5">
                <Globe2 className="h-3.5 w-3.5" /> Globe
              </TabsTrigger>
              <TabsTrigger value="local" className="gap-1.5">
                <Mountain className="h-3.5 w-3.5" /> Local terrain
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <TimeControls />

      {timeline.loading ? <LoadingState label="Fetching observer ephemeris…" /> : null}
      {timeline.error ? <ErrorState message={timeline.error} onRetry={timeline.reload} /> : null}
      {mode === "local" && mesh.error ? <ErrorState message={mesh.error} onRetry={mesh.reload} /> : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="overflow-hidden lg:col-span-3">
          <div className="relative h-[560px] w-full bg-[#050C16]">
            {mode === "globe" ? (
              <SceneCanvas cameraPosition={[1.8, 1.4, 2.6]} minDistance={1.4} maxDistance={8}>
                <LunarGlobe
                  sites={sites}
                  selectedSlug={selectedSlug}
                  onSelect={setSelectedSlug}
                  sunScene={sunScene}
                  earthScene={earthScene}
                  subsolarLatLon={subsolar}
                  subearthLatLon={subearth}
                />
              </SceneCanvas>
            ) : (
              <SceneCanvas cameraPosition={[1.6, 1.1, 2.2]} minDistance={0.6} maxDistance={7} stars={false}>
                <ObserverScene
                  mesh={mesh.data}
                  horizon={horizon.data}
                  observerHeightM={2}
                  sun={row?.sun ? { azimuth_deg: row.sun.azimuth_deg, elevation_deg: row.sun.elevation_deg } : null}
                  earth={
                    row?.earth
                      ? { azimuth_deg: row.earth.azimuth_deg, elevation_deg: row.earth.elevation_deg }
                      : null
                  }
                />
              </SceneCanvas>
            )}

            <div className="pointer-events-none absolute left-3 top-3 space-y-1">
              <Badge variant="muted" className="font-mono">
                {mode === "globe" ? "Body-fixed frame · scene = (bf.y, bf.z, bf.x)" : "Local ENU · X=East, Y=Up, −Z=North"}
              </Badge>
              {mode === "globe" ? (
                <div className="flex gap-2">
                  <Badge className="font-mono">gold = Sun</Badge>
                  <Badge variant="muted" className="font-mono">blue = Earth</Badge>
                </div>
              ) : null}
            </div>

            {rows.length > 1 ? (
              <div className="absolute bottom-3 left-3 right-3">
                <input
                  type="range"
                  min={0}
                  max={rows.length - 1}
                  value={Math.min(sampleIndex, rows.length - 1)}
                  onChange={(e) => setSampleIndex(Number(e.target.value))}
                  className="w-full accent-[#D5B77A]"
                />
                <div className="mt-1 flex justify-between font-mono text-[10px] text-lunanav-muted">
                  <span>{rows[0]?.time}</span>
                  <span className="text-lunanav-gold">{row?.time}</span>
                  <span>{rows[rows.length - 1]?.time}</span>
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Observer &amp; site</CardTitle>
            </CardHeader>
            <CardContent>
              <MetricRow label="Site" value={selectedSite?.name ?? DASH} mono={false} />
              <MetricRow label="Latitude" value={num(lat, 3, "°")} />
              <MetricRow label="Longitude" value={num(lon, 3, "° E+")} />
              <MetricRow label="Observer height" value="2.0 m" />
              <MetricRow
                label="Terrain available"
                value={mesh.data ? (mesh.data.available ? "yes" : "no") : DASH}
              />
              {mesh.data ? <MetricRow label="Terrain source" value={mesh.data.source} /> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sky at {row?.time ?? DASH}</CardTitle>
            </CardHeader>
            <CardContent>
              <MetricRow
                label="Sun az / el"
                value={`${num(row?.sun?.azimuth_deg, 2, "°")} / ${num(row?.sun?.elevation_deg, 2, "°")}`}
              />
              <MetricRow
                label="Earth az / el"
                value={`${num(row?.earth?.azimuth_deg, 2, "°")} / ${num(row?.earth?.elevation_deg, 2, "°")}`}
              />
              <MetricRow
                label="Sun terrain-lit"
                value={
                  row?.illumination?.illuminated === null || row?.illumination?.illuminated === undefined
                    ? DASH
                    : row.illumination.illuminated
                      ? "yes"
                      : "no"
                }
              />
              <MetricRow
                label="Earth terrain access"
                value={row?.earth_link?.terrain_visible == null ? DASH : row.earth_link.terrain_visible ? "yes" : "no"}
              />
              <MetricRow label="Est. power" value={num(row?.solar_power_w, 1, " W")} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Frame notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] leading-relaxed text-lunanav-muted">
              <p>
                Selenographic MEAN_ME coordinates, East-longitude positive, spherical shape model
                R = 1737.4 km (matches the Horizons <span className="font-mono">coord@301</span> geometry).
              </p>
              <p>
                Sun/Earth directions come from real JPL Horizons OBSERVER ephemerides; the globe is not
                spun by an arbitrary angular increment.
              </p>
              {mesh.data ? (
                <p>
                  Local view shows a {mesh.data.size_km} km DEM patch with vertical exaggeration for
                  legibility; heights are genuine LOLA elevations.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Disclaimer text="Terrain geometry is from NASA LRO LOLA data where a local tile is available; otherwise the API reports terrain as unavailable rather than substituting a synthetic surface." />
    </div>
  );
}
