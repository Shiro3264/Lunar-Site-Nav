import { useState } from "react";
import { Calculator, Zap } from "lucide-react";

import { PowerChart } from "@/components/charts";
import {
  Disclaimer,
  ErrorState,
  LoadingState,
  MetricRow,
  SectionHeader,
  Stat,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { api } from "@/lib/api";
import { BRAND } from "@/lib/constants";
import { DASH, num, pct } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useApp } from "@/state/AppContext";

interface PanelConfig {
  area_m2: number;
  efficiency: number;
  tilt_from_horizontal_deg: number;
  azimuth_deg: number;
  system_derate: number;
}

interface PanelField {
  key: keyof PanelConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  digits: number;
  unit?: string;
}

const FIELDS: PanelField[] = [
  { key: "area_m2", label: "Panel area (m²)", min: 0.1, max: 20, step: 0.1, digits: 2 },
  { key: "efficiency", label: "Efficiency (0–1)", min: 0.05, max: 0.5, step: 0.01, digits: 2 },
  { key: "tilt_from_horizontal_deg", label: "Tilt from horizontal (°)", min: 0, max: 90, step: 1, digits: 0 },
  { key: "azimuth_deg", label: "Azimuth (°)", min: 0, max: 360, step: 1, digits: 0 },
  { key: "system_derate", label: "System derate (0–1)", min: 0.1, max: 1, step: 0.01, digits: 2 },
];

const ECHO_LABELS: Record<string, string> = {
  area_m2: "Panel area",
  efficiency: "Efficiency",
  tilt_from_horizontal_deg: "Tilt from horizontal",
  azimuth_deg: "Azimuth",
  system_derate: "System derate",
};

export default function SolarEnergy() {
  const { selectedSite, selectedSlug, window: win } = useApp();

  const [panel, setPanel] = useState<PanelConfig>({
    area_m2: 1.0,
    efficiency: 0.28,
    tilt_from_horizontal_deg: 90,
    azimuth_deg: 0,
    system_derate: 0.85,
  });
  const [submitted, setSubmitted] = useState<PanelConfig | null>(null);

  const { data, loading, error, reload } = useAsync(
    () =>
      selectedSlug && submitted
        ? api.solarEstimate({
            site_slug: selectedSlug,
            start: win.start,
            stop: win.stop,
            step: win.step,
            panel: submitted,
          })
        : Promise.resolve(null),
    [selectedSlug, win.start, win.stop, win.step, submitted],
    { enabled: Boolean(selectedSlug) && submitted !== null },
  );

  function update(key: keyof PanelConfig, value: number) {
    if (Number.isNaN(value)) return;
    setPanel((prev) => ({ ...prev, [key]: value }));
  }

  if (!selectedSlug) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Solar Energy Estimator" subtitle="No site selected" />
        <Card className="p-6 text-sm text-lunanav-muted">
          Select a landing site to configure a panel and estimate its power output.
        </Card>
      </div>
    );
  }

  const rows = data?.timeline ?? data?.rows ?? [];
  const summary = data?.solar_summary ?? null;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Solar Energy Estimator"
        subtitle={`${selectedSite?.name ?? selectedSlug} · ${win.start} → ${win.stop} UT · step ${win.step}`}
        actions={
          <Button variant="outline" size="sm" onClick={reload} disabled={!submitted}>
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-lunanav-gold" /> Panel configuration
          </CardTitle>
          <p className="text-xs text-lunanav-muted">
            Configure the array geometry, then press Estimate to run the estimator over the current
            time window.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`panel-${f.key}`}>{f.label}</Label>
                  <Input
                    id={`panel-${f.key}`}
                    type="number"
                    className="h-8 w-28 text-right"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={panel[f.key]}
                    onChange={(e) => update(f.key, Number(e.target.value))}
                  />
                </div>
                <Slider
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={[panel[f.key]]}
                  onValueChange={(v) => update(f.key, v[0])}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setSubmitted({ ...panel })} disabled={loading}>
              <Zap className="h-3.5 w-3.5" /> Estimate
            </Button>
            {submitted ? null : (
              <span className="font-mono text-[11px] text-lunanav-muted">
                Press Estimate to compute.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? <LoadingState label="Estimating solar power…" /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {data && summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Stat
              label="Peak power"
              value={num(summary.peak_power_w, 2)}
              unit="W"
              hint="maximum instantaneous"
              accent="#FBBF24"
            />
            <Stat
              label="Mean power"
              value={num(summary.mean_power_w, 2)}
              unit="W"
              hint="averaged over window"
            />
            <Stat
              label="Total energy"
              value={num(summary.energy_wh, 1)}
              unit="Wh"
              hint="integrated over window"
              accent={BRAND.gold}
            />
            <Stat
              label="Equivalent sun hours"
              value={num(summary.equivalent_sun_hours, 2)}
              unit="h"
              hint="energy ÷ peak power"
            />
            <Stat
              label="Illuminated fraction"
              value={pct(summary.illuminated_fraction)}
              hint="terrain-aware"
            />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-lunanav-gold" /> Estimated power vs time
              </CardTitle>
              <span className="font-mono text-[11px] text-lunanav-muted">
                {rows.length} samples · step {data.window.step}
              </span>
            </CardHeader>
            <CardContent>
              <PowerChart data={rows.map((r) => ({ time: r.time, powerW: r.solar_power_w }))} />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Effective panel configuration</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.entries(summary.panel).length === 0 ? (
                  <p className="text-xs text-lunanav-muted">{DASH}</p>
                ) : (
                  Object.entries(summary.panel).map(([key, value]) => (
                    <MetricRow
                      key={key}
                      label={ECHO_LABELS[key] ?? key}
                      value={num(value, 2)}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Model assumptions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-lunanav-muted">
                  {summary.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
                <Separator />
                <p className="text-xs text-lunanav-muted">{summary.note || DASH}</p>
              </CardContent>
            </Card>
          </div>

          <Disclaimer
            className="border-lunanav-gold/40 bg-lunanav-gold/5"
            text="These are ESTIMATES only and must not be treated as a flight power budget. The body is airless, so no atmospheric attenuation or scattering is modelled; the only loss applied is the system derate factor. Real arrays are further affected by temperature, dust/regolith accumulation, degradation, wiring and converter losses, pointing error and shadowing — none of which are included here."
          />
        </>
      ) : null}
    </div>
  );
}
