import { useEffect, useMemo, useState } from "react";
import { Compass, Eye } from "lucide-react";

import {
  ConfidenceBadge,
  Disclaimer,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricRow,
  SectionHeader,
} from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { DASH, altitude as altText, num } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useApp } from "@/state/AppContext";
import { ObserverScene } from "@/three/ObserverScene";
import { SceneCanvas } from "@/three/SceneCanvas";
import { azimuthCompass } from "@/three/coords";

const OBSERVER_HEIGHT_M = 2;

export default function ObserverPerspective() {
  const { selectedSite, selectedSlug, sites, window: win } = useApp();
  const [sampleIndex, setSampleIndex] = useState(0);

  const lat = selectedSite?.latitude ?? null;
  const lon = selectedSite?.longitude ?? null;

  const mesh = useAsync(
    () => api.terrainMesh({ latitude: lat ?? 0, longitude: lon ?? 0, size_km: 8, grid: 56 }),
    [lat, lon],
    { enabled: lat !== null && lon !== null },
  );

  const horizon = useAsync(
    () =>
      api.terrainHorizon({
        latitude: lat ?? 0,
        longitude: lon ?? 0,
        azimuths: 72,
        observer_height_m: OBSERVER_HEIGHT_M,
      }),
    [lat, lon],
    { enabled: lat !== null && lon !== null },
  );

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

  const rows = timeline.data?.rows ?? [];

  useEffect(() => {
    if (rows.length && sampleIndex >= rows.length) setSampleIndex(0);
  }, [rows.length, sampleIndex]);

  const row = rows[Math.min(sampleIndex, Math.max(0, rows.length - 1))] ?? null;

  const horizonRange = useMemo(() => {
    const profile = horizon.data?.profile ?? [];
    if (!profile.length) return { min: null as number | null, max: null as number | null };
    const values = profile.map((p) => p.horizon_elevation_deg);
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [horizon.data]);

  if (!selectedSite) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Observer Perspective" subtitle="No site selected" />
        <EmptyState message="Select a landing site to render its horizon-level observer view." />
      </div>
    );
  }

  const sunAz = row?.sun?.azimuth_deg ?? null;
  const sunEl = row?.sun?.elevation_deg ?? null;
  const earthAz = row?.earth?.azimuth_deg ?? null;
  const earthEl = row?.earth?.elevation_deg ?? null;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Observer Perspective"
        subtitle={`${selectedSite.name} · horizon-level first-person view · ${win.start} → ${win.stop} UT`}
        actions={
          <Badge variant="muted" className="font-mono">
            observer +{OBSERVER_HEIGHT_M} m
          </Badge>
        }
      />

      {timeline.loading ? <LoadingState label="Fetching observer ephemeris…" /> : null}
      {timeline.error ? <ErrorState message={timeline.error} onRetry={timeline.reload} /> : null}
      {mesh.error ? <ErrorState message={mesh.error} onRetry={mesh.reload} /> : null}
      {horizon.error ? <ErrorState message={horizon.error} onRetry={horizon.reload} /> : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="overflow-hidden lg:col-span-3">
          <div className="relative h-[560px] w-full bg-[#050C16]">
            <SceneCanvas
              cameraPosition={[1.6, 1.1, 2.2]}
              minDistance={0.6}
              maxDistance={7}
              stars={false}
            >
              <ObserverScene
                mesh={mesh.data}
                horizon={horizon.data}
                observerHeightM={OBSERVER_HEIGHT_M}
                sun={row?.sun ? { azimuth_deg: sunAz, elevation_deg: sunEl } : null}
                earth={row?.earth ? { azimuth_deg: earthAz, elevation_deg: earthEl } : null}
              />
            </SceneCanvas>

            <div className="pointer-events-none absolute left-3 top-3 space-y-1">
              <Badge variant="muted" className="font-mono">
                Local ENU · X=East, Y=Up, −Z=North
              </Badge>
              <div className="flex gap-2">
                <Badge className="font-mono">gold = Sun</Badge>
                <Badge variant="muted" className="font-mono">blue = Earth</Badge>
              </div>
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
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-lunanav-gold" />
                Sky at {row?.time ?? DASH}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MetricRow
                label="Sun azimuth"
                value={`${num(sunAz, 2, "°")}${sunAz === null ? "" : ` (${azimuthCompass(sunAz)})`}`}
              />
              <MetricRow label="Sun elevation" value={num(sunEl, 2, "°")} />
              <MetricRow
                label="Earth azimuth"
                value={`${num(earthAz, 2, "°")}${earthAz === null ? "" : ` (${azimuthCompass(earthAz)})`}`}
              />
              <MetricRow label="Earth elevation" value={num(earthEl, 2, "°")} />
              <MetricRow
                label="Terrain-lit"
                value={
                  row?.illumination?.illuminated == null
                    ? DASH
                    : row.illumination.illuminated
                      ? "yes"
                      : "no"
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-lunanav-gold" />
                Terrain horizon
              </CardTitle>
              {horizon.data ? <ConfidenceBadge confidence={horizon.data.confidence} /> : null}
            </CardHeader>
            <CardContent>
              <MetricRow label="Site" value={selectedSite.name} mono={false} />
              <MetricRow
                label="DEM relief"
                value={mesh.data ? `${altText(mesh.data.min_m)} – ${altText(mesh.data.max_m)}` : DASH}
              />
              <MetricRow label="Horizon min" value={num(horizonRange.min, 2, "°")} />
              <MetricRow label="Horizon max" value={num(horizonRange.max, 2, "°")} />
              <MetricRow
                label="Terrain available"
                value={horizon.data ? (horizon.data.terrain_available ? "yes" : "no") : DASH}
              />
              <MetricRow label="Azimuth samples" value={num(horizon.data?.profile.length ?? null, 0)} />
              {mesh.data ? (
                <MetricRow label="Terrain source" value={mesh.data.source} />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Horizons explained</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] leading-relaxed text-lunanav-muted">
              <p>
                <span className="text-lunanav-silver">Geometric horizon (0°):</span> the ideal flat
                tangent plane at the observer&rsquo;s eye — a body is geometrically up when its centre is
                above 0°.
              </p>
              <p>
                <span className="text-lunanav-silver">Terrain skyline:</span> the real measured LOLA
                silhouette for each azimuth, shown as the grey profile line. A body can be geometrically
                above 0° yet still hidden behind mountains or crater rims.
              </p>
              <p>
                <span className="text-lunanav-silver">Terrain-obstructed vs actual illumination:</span>{" "}
                being above the geometric horizon does not guarantee sunlight — the Sun may be blocked by
                terrain. &ldquo;Terrain-lit&rdquo; above is the terrain-aware result, which can differ from
                the purely geometric daylight state.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Disclaimer text="Terrain is from NASA LRO LOLA where a local DEM tile is available; if the API reports terrain as unavailable, no synthetic surface is substituted. Sky positions are real JPL Horizons directions for the selected site and epoch." />
    </div>
  );
}
