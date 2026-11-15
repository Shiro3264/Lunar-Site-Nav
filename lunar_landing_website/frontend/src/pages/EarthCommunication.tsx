import { Satellite } from "lucide-react";

import { AzElChart } from "@/components/charts";
import {
  Disclaimer,
  ErrorState,
  LoadingState,
  SectionHeader,
  Stat,
} from "@/components/common";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DASH, num, pct } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useApp } from "@/state/AppContext";

/** Accessibility string → alert-badge variant (matches ACCESSIBILITY_STYLES semantics). */
function accessibilityVariant(a: string): BadgeProps["variant"] {
  switch (a) {
    case "excellent":
      return "success";
    case "good":
      return "default";
    case "low_elevation":
      return "warn";
    case "below_horizon":
    case "blocked_by_terrain":
      return "danger";
    default:
      return "muted";
  }
}

function AccessibilityBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <Badge variant="muted">{DASH}</Badge>;
  return (
    <Badge variant={accessibilityVariant(value)} className="capitalize">
      {value.replace(/_/g, " ")}
    </Badge>
  );
}

export default function EarthCommunication() {
  const { selectedSite, selectedSlug, window: win } = useApp();

  const { data, loading, error, reload } = useAsync(
    () =>
      selectedSlug
        ? api.communicationAnalyze({
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
        <SectionHeader title="Earth Communication Analysis" subtitle="No site selected" />
        <Card className="p-6 text-sm text-lunanav-muted">
          Select a landing site to run the Earth-visibility analysis.
        </Card>
      </div>
    );
  }

  const rows = data?.timeline ?? data?.rows ?? [];
  const summary = data?.communication_summary ?? null;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Earth Communication Analysis"
        subtitle={`${selectedSite?.name ?? selectedSlug} · ${win.start} → ${win.stop} UT · step ${win.step}`}
        actions={
          <Button variant="outline" size="sm" onClick={reload}>
            Refresh
          </Button>
        }
      />

      {loading ? <LoadingState label="Computing Earth line-of-sight geometry…" /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {data && summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Stat
              label="Geometric visibility"
              value={pct(summary.geometric_fraction)}
              hint="Earth above idealised horizon"
              accent="#6FA8DC"
            />
            <Stat
              label="Terrain access"
              value={pct(summary.terrain_fraction)}
              hint="Earth clears local skyline"
              accent="#34D399"
            />
            <Stat
              label="Max required mast"
              value={num(summary.max_required_mast_m, 2)}
              unit="m"
              hint="worst-case to regain line-of-sight"
            />
            <Stat
              label="Mean Earth elevation"
              value={num(summary.mean_elevation_deg, 2)}
              unit="°"
              hint="averaged over window"
            />
            <Stat
              label="Peak Earth elevation"
              value={num(summary.peak_elevation_deg, 2)}
              unit="°"
              hint="highest in window"
            />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Satellite className="h-4 w-4 text-lunanav-gold" /> Earth apparent angles
              </CardTitle>
              <Badge variant="muted" className="font-mono">
                az / el over time
              </Badge>
            </CardHeader>
            <CardContent>
              <AzElChart
                data={rows.map((r) => ({
                  time: r.time,
                  sunAz: null,
                  sunEl: null,
                  earthAz: r.earth_link.earth_azimuth_deg ?? null,
                  earthEl: r.earth_link.earth_elevation_deg ?? null,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Earth-visibility timeline</CardTitle>
              <p className="text-xs text-lunanav-muted">
                {rows.length} samples · step {data.window.step}
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time (UT)</TableHead>
                    <TableHead>Earth az (°)</TableHead>
                    <TableHead>Earth el (°)</TableHead>
                    <TableHead>Terrain horizon (°)</TableHead>
                    <TableHead>Elevation margin (°)</TableHead>
                    <TableHead>Required mast (m)</TableHead>
                    <TableHead>Accessibility</TableHead>
                    <TableHead>One-way light time (s)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.time}>
                      <TableCell className="whitespace-nowrap">{r.time}</TableCell>
                      <TableCell>{num(r.earth_link.earth_azimuth_deg, 2)}</TableCell>
                      <TableCell>{num(r.earth_link.earth_elevation_deg, 2)}</TableCell>
                      <TableCell>{num(r.earth_link.terrain_horizon_deg, 2)}</TableCell>
                      <TableCell>{num(r.earth_link.elevation_margin_deg, 2)}</TableCell>
                      <TableCell>{num(r.earth_link.required_mast_m, 2)}</TableCell>
                      <TableCell>
                        <AccessibilityBadge value={r.earth_link.accessibility} />
                      </TableCell>
                      <TableCell>{num(r.earth_link.one_way_light_time_s, 3)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Geometry only — not an RF link budget</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-relaxed text-lunanav-muted">
              <p>
                This module evaluates <span className="text-lunanav-white">line-of-sight geometry</span>{" "}
                only: whether the Earth lies above the idealised horizon and whether local terrain
                obstructs it. It does <span className="text-lunanav-white">not</span> account for antenna
                gain, transmit power, receiver sensitivity, noise, Doppler shift, pointing errors, or
                atmospheric effects — it is not a full RF link budget.
              </p>
              <p>
                One-way light time is quoted at the vacuum speed of light{" "}
                <span className="font-mono text-lunanav-white">c ≈ 299 792 km/s</span>, based on the
                instantaneous Earth–Moon range. Round-trip time is therefore approximately double the
                listed value.
              </p>
              <Disclaimer text={DISCLAIMER} />
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
