import { Link } from "react-router-dom";
import { ArrowUpRight, Compass, Moon, Satellite, Sun, Zap } from "lucide-react";

import { AzElChart, SubScoreRadar } from "@/components/charts";
import {
  Disclaimer,
  ErrorState,
  LoadingState,
  MetricRow,
  SectionHeader,
  Stat,
} from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { BRAND, DISCLAIMER } from "@/lib/constants";
import { DASH, altitude as altText, gradeStyle, num, pct } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useApp } from "@/state/AppContext";

export default function Dashboard() {
  const { selectedSite, selectedSlug, window: win, sites } = useApp();

  const { data, loading, error, reload } = useAsync(
    () =>
      selectedSlug
        ? api.analyze({
            site_slug: selectedSlug,
            start: win.start,
            stop: win.stop,
            step: win.step,
          })
        : Promise.resolve(null),
    [selectedSlug, win.start, win.stop, win.step],
    { enabled: Boolean(selectedSlug) },
  );

  if (!selectedSlug) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Mission Overview Dashboard" subtitle="No site selected" />
        <Card className="p-6 text-sm text-lunanav-muted">
          Load a landing site to begin. {sites.length === 0 ? "No candidate sites were returned by the API." : null}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Mission Overview Dashboard"
        subtitle={`${selectedSite?.name ?? selectedSlug} · ${win.start} → ${win.stop} UT · step ${win.step}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/navigator">
                <Compass className="h-3.5 w-3.5" /> Open 3D Navigator
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={reload}>
              Refresh
            </Button>
          </div>
        }
      />

      {loading ? <LoadingState label="Running illumination, power and communication analysis…" /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {data ? (
        <>
          {/* Site + suitability headline */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-lunanav-gold" />
                  {data.site.name ?? selectedSite?.name}
                </CardTitle>
                <Badge variant="muted" className="font-mono">
                  {num(data.site.latitude_deg, 3)}°, {num(data.site.longitude_deg, 3)}°
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-x-6 gap-y-0 sm:grid-cols-2">
                  <MetricRow label="Region" value={selectedSite?.region || DASH} mono={false} />
                  <MetricRow label="Elevation" value={altText(data.terrain.elevation_m)} />
                  <MetricRow label="Terrain source" value={data.terrain.source} />
                  <MetricRow label="Dataset resolution" value={data.terrain.resolution_m ? `${data.terrain.resolution_m} m` : DASH} />
                  <MetricRow label="Slope" value={num(data.terrain.slope_deg, 2, "°")} />
                  <MetricRow label="Roughness (RMS)" value={num(data.terrain.roughness_rms_m, 1, " m")} />
                  <MetricRow label="Local relief" value={num(data.terrain.local_relief_m, 0, " m")} />
                  <MetricRow
                    label="Mean radius model"
                    value="R = 1737.4 km (spherical)"
                  />
                </div>
                <Separator />
                <p className="text-[11px] leading-relaxed text-lunanav-muted">
                  Coordinates are selenographic MEAN_ME, East-longitude positive. Azimuth is clockwise
                  from North. Terrain metrics are derived from NASA LRO LOLA data where available.
                </p>
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>Suitability Index</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col items-center justify-center gap-3">
                <div className="text-center">
                  <div className="font-mono text-5xl font-semibold" style={{ color: BRAND.gold }}>
                    {data.suitability.composite_score === null
                      ? DASH
                      : data.suitability.composite_score.toFixed(1)}
                  </div>
                  <div className="mono-label mt-1">weighted 0–100 heuristic</div>
                </div>
                <Badge className={`capitalize ${gradeStyle(data.suitability.grade)}`}>
                  {data.suitability.grade.replace("_", " ")}
                </Badge>
                <Disclaimer text={data.suitability.disclaimer} className="w-full" />
              </CardContent>
            </Card>
          </div>

          {/* Summary stats */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Illuminated fraction"
              value={pct(data.illumination_summary.illuminated_fraction)}
              hint={`${data.illumination_summary.illuminated_samples}/${data.illumination_summary.samples} samples`}
              accent={BRAND.gold}
            />
            <Stat
              label="Longest darkness"
              value={num(data.illumination_summary.longest_continuous_darkness_h, 2)}
              unit="h"
              hint="continuous, within the window"
            />
            <Stat
              label="Earth terrain access"
              value={pct(data.communication_summary.terrain_fraction)}
              hint={`peak elevation ${num(data.communication_summary.peak_elevation_deg, 2, "°")}`}
              accent="#6FA8DC"
            />
            <Stat
              label="Est. solar energy"
              value={num(data.solar_summary.energy_wh, 1)}
              unit="Wh"
              hint="estimate — not a flight power budget"
              accent="#FBBF24"
            />
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-lunanav-gold" /> Sun &amp; Earth apparent angles
                </CardTitle>
                <Badge variant="muted" className="font-mono">
                  JPL Horizons · QUANTITIES=4
                </Badge>
              </CardHeader>
              <CardContent>
                <AzElChart
                  data={(data.timeline ?? data.rows ?? []).map((r) => ({
                    time: r.time,
                    sunAz: r.sun?.azimuth_deg ?? null,
                    sunEl: r.sun?.elevation_deg ?? null,
                    earthAz: r.earth?.azimuth_deg ?? null,
                    earthEl: r.earth?.elevation_deg ?? null,
                  }))}
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Sub-score contributions</CardTitle>
              </CardHeader>
              <CardContent>
                <SubScoreRadar
                  data={data.suitability.sub_scores.map((s) => ({ label: s.label, score: s.score }))}
                />
              </CardContent>
            </Card>
          </div>

          {/* Module links */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { to: "/sunlight", icon: Sun, title: "Sunlight & Shadows", desc: "Terrain-aware illumination and skyline" },
              { to: "/earth-comms", icon: Satellite, title: "Earth Communication", desc: "Geometry, mast height and light-time" },
              { to: "/solar", icon: Zap, title: "Solar Energy", desc: "Panel-configurable power estimate" },
              { to: "/observer", icon: Moon, title: "Observer View", desc: "Horizon-level vantage of the site" },
            ].map(({ to, icon: Icon, title, desc }) => (
              <Link key={to} to={to}>
                <Card className="h-full p-4 transition-colors hover:border-lunanav-gold/40 hover:bg-white/[0.03]">
                  <div className="flex items-start justify-between">
                    <Icon className="h-4 w-4 text-lunanav-gold" />
                    <ArrowUpRight className="h-3.5 w-3.5 text-lunanav-muted" />
                  </div>
                  <div className="mt-3 font-display text-sm font-semibold">{title}</div>
                  <div className="mt-1 text-[11px] text-lunanav-muted">{desc}</div>
                </Card>
              </Link>
            ))}
          </div>

          <Disclaimer text={DISCLAIMER} />
        </>
      ) : null}
    </div>
  );
}
