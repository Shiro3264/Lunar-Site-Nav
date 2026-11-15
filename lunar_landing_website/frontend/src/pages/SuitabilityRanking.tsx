import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ListOrdered, Scale } from "lucide-react";

import { SubScoreBars } from "@/components/charts";
import {
  Disclaimer,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricRow,
  SectionHeader,
} from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, type RankedSite } from "@/lib/api";
import { DASH, altitude, num, pct, gradeStyle, scoreColor } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useApp } from "@/state/AppContext";
import { cn } from "@/lib/utils";

const WEIGHT_ORDER = ["illumination", "terrain", "communication", "energy", "thermal"];

export default function SuitabilityRanking() {
  const { sites, window: win } = useApp();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailSlug, setDetailSlug] = useState<string | null>(null);

  const slugs = useMemo(() => sites.map((s) => s.slug), [sites]);
  const slugKey = slugs.join(",");

  const { data, loading, error, reload } = useAsync(
    () => api.suitabilityRank({ site_slugs: slugs, start: win.start, stop: win.stop, step: win.step }),
    [slugKey, win.start, win.stop, win.step],
    { enabled: slugs.length > 0 },
  );

  const ranked = data?.sites ?? [];
  const detailSite =
    ranked.find((s) => s.slug === detailSlug) ?? ranked[0] ?? null;

  const weightEntries = useMemo(() => {
    const weights = data?.weights ?? {};
    const keys = WEIGHT_ORDER.filter((k) => k in weights);
    for (const k of Object.keys(weights)) if (!keys.includes(k)) keys.push(k);
    return keys.map((k) => [k, weights[k]] as const);
  }, [data]);

  const missing = detailSite
    ? detailSite.sub_scores.filter((s) => s.score === null).map((s) => s.key)
    : [];

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Suitability Ranking"
        subtitle={`${ranked.length || sites.length} candidate sites · ${win.start} → ${win.stop} UT · step ${win.step}`}
        actions={
          <Button variant="outline" size="sm" onClick={reload}>
            Refresh
          </Button>
        }
      />

      {loading ? <LoadingState label="Ranking candidate landing sites…" /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {!loading && !error && slugs.length === 0 ? (
        <EmptyState message="No candidate sites were returned by the API. Run the seed command and reload." />
      ) : null}

      {data ? (
        <>
          {/* Transparent weights + detail */}
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center gap-2 space-y-0">
                <Scale className="h-4 w-4 text-lunanav-gold" />
                <CardTitle>Composite weights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sub-index</TableHead>
                      <TableHead className="text-right">Weight</TableHead>
                      <TableHead className="text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weightEntries.map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell className="capitalize text-lunanav-white">{key}</TableCell>
                        <TableCell className="text-right">{num(value, 2)}</TableCell>
                        <TableCell className="text-right" style={{ color: scoreColor((value ?? 0) * 100) }}>
                          {pct(value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="pt-1 text-[11px] leading-relaxed text-lunanav-muted">
                  The composite index is the weight-normalised sum of the sub-scores below. Weights are
                  published so every ranking is fully reproducible.
                </p>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <ListOrdered className="h-4 w-4 text-lunanav-gold" /> Sub-score profile
                </CardTitle>
                {ranked.length ? (
                  <Select
                    value={detailSite?.slug}
                    onValueChange={(v) => setDetailSlug(v)}
                  >
                    <SelectTrigger className="h-8 w-[220px] text-xs">
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      {ranked.map((s, i) => (
                        <SelectItem key={s.slug} value={s.slug}>
                          #{i + 1} {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-3">
                {detailSite ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="font-mono text-3xl font-semibold"
                        style={{ color: scoreColor(detailSite.composite_score) }}
                      >
                        {num(detailSite.composite_score, 1)}
                      </span>
                      <Badge className={cn("capitalize", gradeStyle(detailSite.grade))}>
                        {detailSite.grade.replace("_", " ")}
                      </Badge>
                    </div>
                    <SubScoreBars
                      data={detailSite.sub_scores.map((s) => ({
                        label: s.label,
                        score: s.score,
                      }))}
                    />
                  </>
                ) : (
                  <EmptyState message="No ranked sites returned." />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Ranked table with expandable rationale */}
          <Card>
            <CardHeader>
              <CardTitle>Ranked candidate sites</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead className="text-right">Composite</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead className="hidden md:table-cell">Sub-scores</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.map((site, i) => {
                    const isOpen = expanded === site.slug;
                    return (
                      <Fragment key={site.slug}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() => setExpanded(isOpen ? null : site.slug)}
                        >
                          <TableCell className="text-lunanav-muted">{i + 1}</TableCell>
                          <TableCell>
                            <div className="text-lunanav-white">{site.name}</div>
                            <div className="text-[10px] text-lunanav-muted">{site.slug}</div>
                          </TableCell>
                          <TableCell
                            className="text-right text-sm font-semibold"
                            style={{ color: scoreColor(site.composite_score) }}
                          >
                            {num(site.composite_score, 1)}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("capitalize", gradeStyle(site.grade))}>
                              {site.grade.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              {site.sub_scores.map((s) => (
                                <span key={s.key} className="text-[11px] text-lunanav-muted">
                                  <span className="capitalize">{s.key}</span>{" "}
                                  <span style={{ color: scoreColor(s.score) }}>
                                    {num(s.score, 0)}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-lunanav-muted">
                            {isOpen ? (
                              <ChevronDown className="inline h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="inline h-3.5 w-3.5" />
                            )}
                          </TableCell>
                        </TableRow>
                        {isOpen ? (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-lunanav-navy/40 p-0">
                              <ExpandedSiteBody site={site} />
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Per-site detail (summaries) */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle>Site detail</CardTitle>
              {ranked.length ? (
                <Select value={detailSite?.slug} onValueChange={(v) => setDetailSlug(v)}>
                  <SelectTrigger className="h-8 w-[220px] text-xs">
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {ranked.map((s, i) => (
                      <SelectItem key={s.slug} value={s.slug}>
                        #{i + 1} {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </CardHeader>
            <CardContent>
              {detailSite ? (
                <div className="grid gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryGroup
                    title="Terrain"
                    rows={[
                      ["Elevation", altitude(detailSite.terrain.elevation_m)],
                      ["Source", detailSite.terrain.source || DASH],
                      ["Resolution", detailSite.terrain.resolution_m ? `${detailSite.terrain.resolution_m} m` : DASH],
                      ["Slope", num(detailSite.terrain.slope_deg, 2, "°")],
                      ["Roughness (RMS)", num(detailSite.terrain.roughness_rms_m, 2, " m")],
                      ["Local relief", num(detailSite.terrain.local_relief_m, 0, " m")],
                    ]}
                  />
                  <SummaryGroup
                    title="Illumination"
                    rows={[
                      ["Illuminated fraction", pct(detailSite.illumination_summary.illuminated_fraction)],
                      ["Illuminated / samples", `${detailSite.illumination_summary.illuminated_samples} / ${detailSite.illumination_summary.samples}`],
                      ["Longest darkness", num(detailSite.illumination_summary.longest_continuous_darkness_h, 2, " h")],
                      ["Longest illumination", num(detailSite.illumination_summary.longest_continuous_illumination_h, 2, " h")],
                      ["Mean Sun el (up)", num(detailSite.illumination_summary.mean_sun_elevation_when_up_deg, 2, "°")],
                    ]}
                  />
                  <SummaryGroup
                    title="Solar"
                    rows={[
                      ["Peak power", num(detailSite.solar_summary.peak_power_w, 1, " W")],
                      ["Mean power", num(detailSite.solar_summary.mean_power_w, 1, " W")],
                      ["Energy", num(detailSite.solar_summary.energy_wh, 1, " Wh")],
                      ["Equivalent sun-hours", num(detailSite.solar_summary.equivalent_sun_hours, 2, " h")],
                      ["Interval", num(detailSite.solar_summary.interval_h, 2, " h")],
                    ]}
                  />
                  <SummaryGroup
                    title="Communication"
                    rows={[
                      ["Geometric fraction", pct(detailSite.communication_summary.geometric_fraction)],
                      ["Terrain fraction", pct(detailSite.communication_summary.terrain_fraction)],
                      ["Mean elevation", num(detailSite.communication_summary.mean_elevation_deg, 2, "°")],
                      ["Peak elevation", num(detailSite.communication_summary.peak_elevation_deg, 2, "°")],
                      ["Max required mast", num(detailSite.communication_summary.max_required_mast_m, 2, " m")],
                    ]}
                  />
                </div>
              ) : (
                <EmptyState message="No ranked sites returned." />
              )}
            </CardContent>
          </Card>

          <Disclaimer
            text={
              `${data.disclaimer} This ranking is a decision-support heuristic derived from the disclosed ` +
              `weights — it is NOT a probability of landing success and does not account for all mission ` +
              `constraints.` +
              (missing.length
                ? ` Sub-scores with missing inputs (score shown as ${DASH}): ${missing.join(", ")}.`
                : "")
            }
          />
        </>
      ) : null}
    </div>
  );
}

function SummaryGroup({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div>
      <div className="mono-label mb-1">{title}</div>
      {rows.map(([label, value]) => (
        <MetricRow key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function ExpandedSiteBody({ site }: { site: RankedSite }) {
  return (
    <div className="space-y-2 px-4 py-3">
      {site.sub_scores.map((s) => (
        <div
          key={s.key}
          className="grid gap-1 border-b border-lunanav-line/50 pb-2 last:border-0 sm:grid-cols-[160px_64px_72px_1fr]"
        >
          <div className="text-xs font-medium text-lunanav-white">{s.label}</div>
          <div className="font-mono text-xs" style={{ color: scoreColor(s.score) }}>
            {num(s.score, 1)}
          </div>
          <div className="font-mono text-[11px] text-lunanav-muted">w {num(s.weight, 2)}</div>
          <div className="text-[11px] leading-relaxed text-lunanav-muted">{s.rationale}</div>
        </div>
      ))}
    </div>
  );
}
