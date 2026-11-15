import { Sun } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AzElChart, fmtTime } from "@/components/charts";
import {
  Disclaimer,
  ErrorState,
  LoadingState,
  SectionHeader,
  Stat,
} from "@/components/common";
import { Badge } from "@/components/ui/badge";
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
import { BRAND, CHART_COLORS, DISCLAIMER } from "@/lib/constants";
import { DASH, num, pct } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useApp } from "@/state/AppContext";

const AXIS = { stroke: CHART_COLORS.axis, fontSize: 10, fontFamily: "IBM Plex Mono" };
const TOOLTIP_STYLE = {
  backgroundColor: "#07111F",
  border: "1px solid #1B2C49",
  borderRadius: 6,
  fontSize: 11,
  fontFamily: "IBM Plex Mono",
  color: "#F4F6F8",
};

function BoolBadge({ value }: { value: boolean | null | undefined }) {
  if (value === null || value === undefined) return <Badge variant="muted">{DASH}</Badge>;
  return <Badge variant={value ? "success" : "danger"}>{value ? "Yes" : "No"}</Badge>;
}

export default function SunlightShadow() {
  const { selectedSite, selectedSlug, window: win } = useApp();

  const { data, loading, error, reload } = useAsync(
    () =>
      selectedSlug
        ? api.illuminationAnalyze({
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
        <SectionHeader title="Sunlight & Shadow Analysis" subtitle="No site selected" />
        <Card className="p-6 text-sm text-lunanav-muted">
          Select a landing site to run the illumination analysis.
        </Card>
      </div>
    );
  }

  const rows = data?.timeline ?? data?.rows ?? [];
  const summary = data?.illumination_summary ?? null;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Sunlight & Shadow Analysis"
        subtitle={`${selectedSite?.name ?? selectedSlug} · ${win.start} → ${win.stop} UT · step ${win.step}`}
        actions={
          <Button variant="outline" size="sm" onClick={reload}>
            Refresh
          </Button>
        }
      />

      {loading ? <LoadingState label="Computing terrain-aware illumination…" /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {data && summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Stat
              label="Illuminated fraction"
              value={pct(summary.illuminated_fraction)}
              hint={`${summary.illuminated_samples}/${summary.samples} samples (terrain-aware)`}
              accent={BRAND.gold}
            />
            <Stat
              label="Geometric daylight"
              value={pct(summary.geometric_daylight_fraction)}
              hint="idealised spherical horizon"
            />
            <Stat
              label="Longest illumination"
              value={num(summary.longest_continuous_illumination_h, 2)}
              unit="h"
              hint="continuous, within window"
              accent="#FBBF24"
            />
            <Stat
              label="Longest darkness"
              value={num(summary.longest_continuous_darkness_h, 2)}
              unit="h"
              hint="continuous, within window"
            />
            <Stat
              label="Mean Sun elevation (up)"
              value={num(summary.mean_sun_elevation_when_up_deg, 2)}
              unit="°"
              hint="averaged while illuminated"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-lunanav-gold" /> Sun apparent angles
                </CardTitle>
                <Badge variant="muted" className="font-mono">
                  az / el over time
                </Badge>
              </CardHeader>
              <CardContent>
                <AzElChart
                  showEarth={false}
                  data={rows.map((r) => ({
                    time: r.time,
                    sunAz: r.sun?.azimuth_deg ?? null,
                    sunEl: r.sun?.elevation_deg ?? null,
                  }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sun elevation vs terrain horizon</CardTitle>
                <p className="text-xs text-lunanav-muted">
                  Where the Sun dips below the local skyline it is geometrically above the horizon but
                  terrain-obstructed.
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart
                    data={rows.map((r) => ({
                      time: r.time,
                      sunEl: r.illumination.sun_elevation_deg ?? null,
                      terrain: r.illumination.terrain_horizon_deg ?? null,
                    }))}
                    margin={{ top: 8, right: 12, left: -14, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="terrainFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.shadow} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={CHART_COLORS.shadow} stopOpacity={0.15} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="time" tickFormatter={fmtTime} {...AXIS} minTickGap={30} />
                    <YAxis domain={[-90, 90]} {...AXIS} />
                    <ReferenceLine y={0} stroke="#5A7699" strokeDasharray="4 4" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => fmtTime(String(v))} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area
                      type="monotone"
                      dataKey="terrain"
                      name="Terrain horizon (°)"
                      stroke={CHART_COLORS.silver}
                      fill="url(#terrainFill)"
                      strokeWidth={1.2}
                      connectNulls={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="sunEl"
                      name="Sun elevation (°)"
                      stroke={CHART_COLORS.sun}
                      fill="transparent"
                      strokeWidth={1.8}
                      connectNulls={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Illumination timeline</CardTitle>
              <p className="text-xs text-lunanav-muted">
                {rows.length} samples · step {data.window.step}
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time (UT)</TableHead>
                    <TableHead>Sun az (°)</TableHead>
                    <TableHead>Sun el (°)</TableHead>
                    <TableHead>Terrain horizon (°)</TableHead>
                    <TableHead>Site daylight</TableHead>
                    <TableHead>Terrain clear</TableHead>
                    <TableHead>Illuminated</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.time}>
                      <TableCell className="whitespace-nowrap">{r.time}</TableCell>
                      <TableCell>{num(r.sun?.azimuth_deg, 2)}</TableCell>
                      <TableCell>{num(r.sun?.elevation_deg, 2)}</TableCell>
                      <TableCell>{num(r.illumination.terrain_horizon_deg, 2)}</TableCell>
                      <TableCell>
                        <BoolBadge value={r.sun?.site_daylight} />
                      </TableCell>
                      <TableCell>
                        <BoolBadge value={r.illumination.terrain_clear} />
                      </TableCell>
                      <TableCell>
                        <BoolBadge value={r.illumination.illuminated} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-lunanav-muted">
                        {r.illumination.reason || DASH}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Four distinct concepts of "visibility"</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-relaxed text-lunanav-muted">
              <div className="space-y-2">
                <div>
                  <span className="font-mono text-lunanav-white">1 · Celestial / geometric visibility</span>{" "}
                  — whether the Sun&apos;s centre and limb lie above an idealised spherical horizon. This
                  ignores local terrain entirely and is the widest of the four definitions.
                </div>
                <div>
                  <span className="font-mono text-lunanav-white">2 · Horizons apparent-body visibility</span>{" "}
                  — the <span className="font-mono">site_daylight</span> marker, computed by JPL Horizons
                  from its own rise/set geometry at the site&apos;s nominal reference height.
                </div>
                <div>
                  <span className="font-mono text-lunanav-white">3 · Terrain-obstructed visibility</span>{" "}
                  — whether the Sun clears the local LOLA-derived skyline (<span className="font-mono">terrain_horizon_deg</span>).
                  A low Sun can be geometrically above the horizon yet hidden behind a ridge.
                </div>
                <div>
                  <span className="font-mono text-lunanav-white">4 · Actual lander-level illumination</span>{" "}
                  — the combined result (<span className="font-mono">illuminated</span>): geometric AND
                  Horizons daylight AND terrain-clear. This is the value relevant to a landed asset.
                </div>
              </div>
              <Disclaimer text={DISCLAIMER} />
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
