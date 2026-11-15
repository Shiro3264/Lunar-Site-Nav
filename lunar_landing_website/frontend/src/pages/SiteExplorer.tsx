import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Compass, Layers, Moon, Satellite, Scale, Sun, Zap } from "lucide-react";

import { SubScoreBars } from "@/components/charts";
import {
  ConfidenceBadge,
  DataSourceTag,
  Disclaimer,
  EmptyState,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { DISCLAIMER } from "@/lib/constants";
import { DASH, altitude as altText, gradeStyle, latLon, num, pct } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useApp } from "@/state/AppContext";
import { cn } from "@/lib/utils";

const MODULE_LINKS = [
  { to: "/navigator", icon: Compass, label: "3D Navigator" },
  { to: "/sunlight", icon: Sun, label: "Sunlight" },
  { to: "/earth-comms", icon: Satellite, label: "Earth Comms" },
  { to: "/solar", icon: Zap, label: "Solar" },
  { to: "/compare", icon: Scale, label: "Compare" },
];

export default function SiteExplorer() {
  const { selectedSlug, setSelectedSlug, window: win } = useApp();
  const { slug: routeSlug } = useParams<{ slug?: string }>();

  useEffect(() => {
    if (routeSlug) setSelectedSlug(routeSlug);
  }, [routeSlug, setSelectedSlug]);

  const list = useAsync(() => api.listSites(true), []);

  const detail = useAsync(
    () => (selectedSlug ? api.getSite(selectedSlug) : Promise.resolve(null)),
    [selectedSlug],
    { enabled: Boolean(selectedSlug) },
  );

  const analysis = useAsync(
    () =>
      selectedSlug
        ? api.siteAnalysis(selectedSlug, { start: win.start, stop: win.stop, step: win.step })
        : Promise.resolve(null),
    [selectedSlug, win.start, win.stop, win.step],
    { enabled: Boolean(selectedSlug) },
  );

  const siteList = list.data?.results ?? [];
  const site = detail.data;
  const terrain = site?.terrain ?? null;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Landing Site Explorer"
        subtitle="Terrain-annotated candidate sites with full illumination, solar and communication analysis."
        actions={
          <Badge variant="muted" className="font-mono">
            {siteList.length} candidate{siteList.length === 1 ? "" : "s"}
          </Badge>
        }
      />

      {list.loading ? <LoadingState label="Loading candidate sites…" /> : null}
      {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : null}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Candidate list */}
        <Card className="h-fit lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-lunanav-gold" />
              Candidate sites
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {siteList.length === 0 && !list.loading ? (
              <div className="px-4 py-6 text-center text-sm text-lunanav-muted">
                No candidate sites returned by the API.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>Lat / Lon</TableHead>
                    <TableHead>Elev</TableHead>
                    <TableHead>Slope</TableHead>
                    <TableHead>Cnf</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {siteList.map((s) => {
                    const active = s.slug === selectedSlug;
                    return (
                      <TableRow
                        key={s.slug}
                        onClick={() => setSelectedSlug(s.slug)}
                        className={cn(
                          "cursor-pointer",
                          active && "bg-lunanav-gold/10 hover:bg-lunanav-gold/15",
                        )}
                      >
                        <TableCell className="font-normal text-lunanav-white">
                          <div className="flex flex-col">
                            <span>{s.name}</span>
                            <span className="text-[10px] text-lunanav-muted">{s.slug}</span>
                          </div>
                        </TableCell>
                        <TableCell>{latLon(s.latitude, s.longitude, 3)}</TableCell>
                        <TableCell>{altText(s.terrain?.elevation_m ?? null)}</TableCell>
                        <TableCell>{num(s.terrain?.slope_deg ?? null, 2, "°")}</TableCell>
                        <TableCell className="text-lunanav-muted">
                          {s.terrain?.confidence ?? DASH}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detail */}
        <div className="space-y-4 lg:col-span-3">
          {!selectedSlug ? (
            <EmptyState message="Select a candidate site to view its terrain and analysis." />
          ) : null}

          {selectedSlug && detail.loading ? <LoadingState label="Loading site detail…" /> : null}
          {selectedSlug && detail.error ? (
            <ErrorState message={detail.error} onRetry={detail.reload} />
          ) : null}

          {site ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-lunanav-gold" />
                  {site.name}
                </CardTitle>
                <Badge variant="muted" className="font-mono">
                  {latLon(site.latitude, site.longitude, 3)}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-x-6 sm:grid-cols-2">
                  <MetricRow label="Region" value={site.region || DASH} mono={false} />
                  <MetricRow label="Slug" value={site.slug} />
                  <MetricRow label="Elevation" value={altText(terrain?.elevation_m ?? null)} />
                  <MetricRow label="Slope" value={num(terrain?.slope_deg ?? null, 2, "°")} />
                  <MetricRow label="Aspect" value={num(terrain?.aspect_deg ?? null, 1, "°")} />
                  <MetricRow
                    label="Roughness (RMS)"
                    value={num(terrain?.roughness_rms_m ?? null, 2, " m")}
                  />
                  <MetricRow
                    label="Local relief"
                    value={num(terrain?.local_relief_m ?? null, 1, " m")}
                  />
                  <MetricRow
                    label="Resolution"
                    value={terrain?.resolution_m ? `${terrain.resolution_m} m` : DASH}
                  />
                  <MetricRow label="Dataset" value={terrain?.dataset ?? DASH} />
                  <MetricRow label="Terrain source" value={terrain?.source ?? DASH} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ConfidenceBadge confidence={terrain?.confidence} />
                  {terrain ? <DataSourceTag source={terrain.source} /> : null}
                  {terrain && !terrain.available ? (
                    <Badge variant="warn" className="font-mono">
                      terrain unavailable
                    </Badge>
                  ) : null}
                </div>
                {site.notes ? (
                  <p className="text-[11px] leading-relaxed text-lunanav-muted">{site.notes}</p>
                ) : null}
                <Separator />
                <div className="flex flex-wrap gap-2">
                  {MODULE_LINKS.map(({ to, icon: Icon, label }) => (
                    <Button key={to} variant="outline" size="sm" asChild>
                      <Link to={to}>
                        <Icon className="h-3.5 w-3.5" /> {label}
                      </Link>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Full analysis */}
          {selectedSlug && analysis.loading ? (
            <LoadingState label="Running illumination, power and communication analysis…" />
          ) : null}
          {selectedSlug && analysis.error ? (
            <ErrorState message={analysis.error} onRetry={analysis.reload} />
          ) : null}

          {analysis.data ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Stat
                  label="Illuminated fraction"
                  value={pct(analysis.data.illumination_summary.illuminated_fraction)}
                  hint={`${analysis.data.illumination_summary.illuminated_samples}/${analysis.data.illumination_summary.samples} samples`}
                  accent="#D5B77A"
                />
                <Stat
                  label="Longest darkness"
                  value={num(analysis.data.illumination_summary.longest_continuous_darkness_h, 2)}
                  unit="h"
                  hint="continuous, within window"
                />
                <Stat
                  label="Earth terrain access"
                  value={pct(analysis.data.communication_summary.terrain_fraction)}
                  hint={`peak elevation ${num(analysis.data.communication_summary.peak_elevation_deg, 2, "°")}`}
                  accent="#6FA8DC"
                />
                <Stat
                  label="Est. solar energy"
                  value={num(analysis.data.solar_summary.energy_wh, 1)}
                  unit="Wh"
                  hint="estimate — not a flight power budget"
                  accent="#FBBF24"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-5">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Suitability Index</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-3">
                    <div className="font-mono text-4xl font-semibold text-lunanav-gold">
                      {analysis.data.suitability.composite_score === null
                        ? DASH
                        : analysis.data.suitability.composite_score.toFixed(1)}
                    </div>
                    <Badge
                      className={`capitalize ${gradeStyle(analysis.data.suitability.grade)}`}
                    >
                      {analysis.data.suitability.grade.replace("_", " ")}
                    </Badge>
                    <div className="mono-label">weighted 0–100 heuristic</div>
                    <div className="w-full">
                      <MetricRow
                        label="Illumination samples"
                        value={num(analysis.data.illumination_summary.samples, 0)}
                      />
                      <MetricRow
                        label="Mean sun elevation (up)"
                        value={num(analysis.data.illumination_summary.mean_sun_elevation_when_up_deg, 2, "°")}
                      />
                      <MetricRow
                        label="Peak power"
                        value={num(analysis.data.solar_summary.peak_power_w, 1, " W")}
                      />
                      <MetricRow
                        label="Comms samples"
                        value={num(analysis.data.communication_summary.samples, 0)}
                      />
                    </div>
                    <Disclaimer text={analysis.data.suitability.disclaimer} className="w-full" />
                  </CardContent>
                </Card>

                <Card className="lg:col-span-3">
                  <CardHeader>
                    <CardTitle>Sub-score contributions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SubScoreBars
                      data={analysis.data.suitability.sub_scores.map((s) => ({
                        label: s.label,
                        score: s.score,
                        weight: s.weight,
                      }))}
                      height={280}
                    />
                  </CardContent>
                </Card>
              </div>

              {analysis.data.suitability.missing_inputs.length ? (
                <div className="rounded-md border border-lunanav-line bg-white/[0.02] px-3 py-2 text-[11px] text-lunanav-muted">
                  Missing inputs: <span className="font-mono">{analysis.data.suitability.missing_inputs.join(", ")}</span>
                </div>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-[11px] leading-relaxed text-lunanav-muted">
                  <p>{analysis.data.illumination_summary.note}</p>
                  <p>{analysis.data.solar_summary.note}</p>
                  {analysis.data.communication_summary.note ? (
                    <p>{analysis.data.communication_summary.note}</p>
                  ) : null}
                </CardContent>
              </Card>

              <Disclaimer text={DISCLAIMER} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
