import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Orbit, Rotate3d } from "lucide-react";

import { fmtTime } from "@/components/charts";
import {
  ConfidenceBadge,
  DataSourceTag,
  Disclaimer,
  ErrorState,
  LoadingState,
  MetricRow,
  SectionHeader,
} from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { api } from "@/lib/api";
import { CHART_COLORS } from "@/lib/constants";
import { DASH, num } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useApp } from "@/state/AppContext";
import { LunarGlobe } from "@/three/LunarGlobe";
import { SceneCanvas } from "@/three/SceneCanvas";

const AXIS = { stroke: CHART_COLORS.axis, fontSize: 10, fontFamily: "IBM Plex Mono" };
const TOOLTIP_STYLE = {
  backgroundColor: "#07111F",
  border: "1px solid #1B2C49",
  borderRadius: 6,
  fontSize: 11,
  fontFamily: "IBM Plex Mono",
  color: "#F4F6F8",
};

export default function RotationSimulator() {
  const { sites, selectedSlug, setSelectedSlug, window: win } = useApp();
  const [sampleIndex, setSampleIndex] = useState(0);

  const rotation = useAsync(
    () => api.moonRotation({ start: win.start, stop: win.stop, step: win.step }),
    [win.start, win.stop, win.step],
  );

  const orientation = useAsync(
    () => api.moonOrientation({ time: win.start }),
    [win.start],
  );

  const samples = rotation.data?.samples ?? [];

  useEffect(() => {
    if (samples.length && sampleIndex >= samples.length) setSampleIndex(0);
  }, [samples.length, sampleIndex]);

  const clampedIndex = Math.min(sampleIndex, Math.max(0, samples.length - 1));
  const sample = samples[clampedIndex] ?? null;

  const chartData = samples.map((s) => ({
    t: s.epoch_utc,
    primeMeridian: s.prime_meridian_deg,
    poleRa: s.pole_ra_deg,
    poleDec: s.pole_dec_deg,
  }));

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Moon Rotation Simulator"
        subtitle="True epoch-dependent lunar rotation from NAIF SPICE — the orientation is a fully ephemeris-driven attitude, never an arbitrary angular increment."
        actions={
          <Badge variant="muted" className="font-mono">
            {win.start} → {win.stop} UT · step {win.step}
          </Badge>
        }
      />

      {rotation.loading ? <LoadingState label="Sampling lunar rotation states…" /> : null}
      {rotation.error ? <ErrorState message={rotation.error} onRetry={rotation.reload} /> : null}

      {rotation.data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <Rotate3d className="h-4 w-4 text-lunanav-gold" />
                  Euler angles &amp; pole orientation
                </CardTitle>
                <Badge variant="muted" className="font-mono">
                  {samples.length} samples
                </Badge>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="t" tickFormatter={fmtTime} {...AXIS} minTickGap={30} />
                    <YAxis yAxisId="pm" domain={[0, 360]} {...AXIS} />
                    <YAxis yAxisId="pole" orientation="right" domain={[-90, 90]} {...AXIS} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => fmtTime(String(v))} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line
                      yAxisId="pm"
                      type="monotone"
                      dataKey="primeMeridian"
                      name="Prime meridian (°)"
                      stroke={CHART_COLORS.gold}
                      dot={false}
                      strokeWidth={1.6}
                      connectNulls={false}
                    />
                    <Line
                      yAxisId="pole"
                      type="monotone"
                      dataKey="poleRa"
                      name="Pole RA (°)"
                      stroke={CHART_COLORS.earth}
                      dot={false}
                      strokeWidth={1.4}
                      connectNulls={false}
                    />
                    <Line
                      yAxisId="pole"
                      type="monotone"
                      dataKey="poleDec"
                      name="Pole Dec (°)"
                      stroke={CHART_COLORS.silver}
                      strokeDasharray="4 3"
                      dot={false}
                      strokeWidth={1.4}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <div className="h-[280px] w-full bg-[#050C16]">
                <SceneCanvas cameraPosition={[1.8, 1.4, 2.6]} minDistance={1.4} maxDistance={8}>
                  <LunarGlobe
                    sites={sites}
                    selectedSlug={selectedSlug}
                    onSelect={setSelectedSlug}
                    showBodies={false}
                  />
                </SceneCanvas>
              </div>
              <CardContent className="pt-3">
                <p className="text-[10px] leading-relaxed text-lunanav-muted">
                  Body-fixed frame · scene = (bf.y, bf.z, bf.x). The globe is shown at its true
                  selenographic coordinates without any fabricated spin.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sample scrubber */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Orbit className="h-4 w-4 text-lunanav-gold" />
                Sample {samples.length ? clampedIndex + 1 : 0} / {samples.length}
              </CardTitle>
              <span className="font-mono text-[11px] text-lunanav-gold">
                {sample?.epoch_utc ?? DASH}
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              {samples.length > 1 ? (
                <Slider
                  min={0}
                  max={Math.max(0, samples.length - 1)}
                  step={1}
                  value={[clampedIndex]}
                  onValueChange={(v) => setSampleIndex(v[0] ?? 0)}
                />
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <MetricRow label="Epoch (UT)" value={sample?.epoch_utc ?? DASH} />
                  <MetricRow label="Prime meridian" value={num(sample?.prime_meridian_deg, 4, "°")} />
                  <MetricRow label="Pole RA" value={num(sample?.pole_ra_deg, 4, "°")} />
                  <MetricRow label="Pole Dec" value={num(sample?.pole_dec_deg, 4, "°")} />
                </div>
                <div>
                  <div className="mono-label mb-1">bodyfixed_to_inertial (3×3)</div>
                  <table className="w-full border-collapse font-mono text-[11px] text-lunanav-white">
                    <tbody>
                      {(sample?.bodyfixed_to_inertial ?? []).map((rowArr, i) => (
                        <tr key={i}>
                          {rowArr.map((v, j) => (
                            <td
                              key={j}
                              className="border border-lunanav-line/60 px-2 py-1 text-right"
                            >
                              {v.toFixed(6)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!(sample?.bodyfixed_to_inertial?.length) ? (
                    <div className="font-mono text-[11px] text-lunanav-muted">{DASH}</div>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Model readouts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Rotation model</CardTitle>
                <ConfidenceBadge confidence={rotation.data.confidence} />
              </CardHeader>
              <CardContent>
                <MetricRow label="Frame" value={rotation.data.frame} />
                <MetricRow label="Reference frame" value={rotation.data.reference_frame} />
                <MetricRow label="Source" value={rotation.data.source} />
                <MetricRow label="Confidence" value={rotation.data.confidence} mono={false} />
                <MetricRow
                  label="Synchronous rotation"
                  value={rotation.data.synchronous_rotation ? "yes" : "no"}
                />
                <MetricRow
                  label="Sidereal period"
                  value={num(rotation.data.sidereal_period_days, 6, " d")}
                />
                <MetricRow label="Mean radius" value={num(rotation.data.mean_radius_km, 1, " km")} />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <DataSourceTag source={rotation.data.source} />
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-lunanav-muted">
                  {rotation.data.note}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Single-epoch orientation</CardTitle>
                {orientation.data ? (
                  <ConfidenceBadge confidence={orientation.data.confidence} />
                ) : null}
              </CardHeader>
              <CardContent>
                {orientation.loading ? (
                  <LoadingState label="Querying single epoch…" />
                ) : orientation.error ? (
                  <ErrorState message={orientation.error} onRetry={orientation.reload} />
                ) : orientation.data ? (
                  <>
                    <MetricRow label="Epoch (UT)" value={orientation.data.epoch_utc} />
                    <MetricRow label="Frame" value={orientation.data.frame} />
                    <MetricRow label="Prime meridian" value={num(orientation.data.prime_meridian_deg, 4, "°")} />
                    <MetricRow label="Pole RA" value={num(orientation.data.pole_ra_deg, 4, "°")} />
                    <MetricRow label="Pole Dec" value={num(orientation.data.pole_dec_deg, 4, "°")} />
                    <p className="mt-3 text-[11px] leading-relaxed text-lunanav-muted">
                      {orientation.data.note}
                    </p>
                  </>
                ) : (
                  <div className="font-mono text-[11px] text-lunanav-muted">{DASH}</div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Why this is not &ldquo;rotation.y += k&rdquo;</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] leading-relaxed text-lunanav-muted">
              <p>
                The Moon&rsquo;s attitude is derived from NAIF SPICE (pck/naif0012 kernels) at each
                requested epoch and includes physical libration — the small periodic rocking driven by
                the Moon&rsquo;s non-spherical gravity field and the Earth&rsquo;s tidal torque.
              </p>
              <p>
                The <span className="font-mono">bodyfixed_to_inertial</span> matrix (shown above for the
                selected sample) distinguishes the inertially-referenced frame from the body-fixed frame.
                Quantities such as the prime meridian angle and the pole RA/Dec therefore vary in a
                non-linear way between epochs.
              </p>
              <p>
                An increment such as <span className="font-mono">rotation.y += k</span> would assume a
                constant, uniform spin rate and ignore libration entirely — it is never used here.
              </p>
              <Separator />
              <p>
                The sphere is a neutral body (mean radius R = 1737.4 km); no fabricated surface texture or
                invented orientation is drawn.
              </p>
            </CardContent>
          </Card>

          <Disclaimer text="Rotation angles and the body-fixed-to-inertial matrix are real SPICE outputs for each epoch. Values are rendered as “—” when the ephemeris is unavailable — never estimated or fabricated." />
        </>
      ) : null}
    </div>
  );
}
