import { useMemo } from "react";
import { Moon, Sun } from "lucide-react";

import { AzElChart, PowerChart, fmtTime } from "@/components/charts";
import {
  Disclaimer,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  Stat,
} from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeControls } from "@/components/layout/TimeControls";
import { api, type TimelineRow } from "@/lib/api";
import { BRAND, DISCLAIMER } from "@/lib/constants";
import { DASH, num, pct } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useApp } from "@/state/AppContext";

function dayKey(value: string): string {
  const m = value.match(/^(\d{4})-(\w{3}-\d{2})/);
  if (m) return `${m[2]} ${m[1]}`;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value.slice(0, 10) : d.toISOString().slice(0, 10);
}

function Dot({ state }: { state: boolean | null | undefined }) {
  const color =
    state === true ? "bg-emerald-400" : state === false ? "bg-red-500/80" : "bg-lunanav-muted/50";
  const title = state === true ? "yes" : state === false ? "no" : "unknown";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} title={title} />;
}

interface MissionEvent {
  label: string;
  value: string;
}

/** Events that can be legitimately derived from the sampled timeline rows only. */
function deriveEvents(rows: TimelineRow[]): MissionEvent[] {
  const events: MissionEvent[] = [];
  if (!rows.length) return events;

  // Sun illumination bounds.
  const litIndices = rows
    .map((r, i) => (r.illumination.illuminated === true ? i : -1))
    .filter((i) => i >= 0);
  if (litIndices.length) {
    events.push({ label: "First illuminated sample", value: rows[litIndices[0]].time });
    events.push({
      label: "Last illuminated sample",
      value: rows[litIndices[litIndices.length - 1]].time,
    });
  }

  // Longest continuous darkness run (explicit illuminated === false only).
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  rows.forEach((r, i) => {
    const dark = r.illumination.illuminated === false;
    if (dark) {
      if (curLen === 0) curStart = i;
      curLen += 1;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curLen = 0;
    }
  });
  if (bestLen > 0) {
    events.push({
      label: "Longest darkness interval",
      value: `${rows[bestStart].time} → ${rows[bestStart + bestLen - 1].time} (${bestLen} samples)`,
    });
  }

  // Earth terrain-access transitions.
  rows.forEach((r, i) => {
    const v = r.earth_link.terrain_visible;
    if (typeof v !== "boolean") return;
    const prev = i > 0 ? rows[i - 1].earth_link.terrain_visible : null;
    const wasVisible = prev === true;
    if (v && !wasVisible) {
      events.push({ label: "Earth terrain access begins", value: r.time });
    } else if (!v && wasVisible) {
      events.push({ label: "Earth terrain access ends", value: r.time });
    }
  });

  return events;
}

export default function MissionTimeline() {
  const { selectedSlug, selectedSite, window: win } = useApp();

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

  const rows = data?.timeline ?? data?.rows ?? [];

  const grouped = useMemo(() => {
    const groups: { day: string; rows: TimelineRow[] }[] = [];
    for (const r of rows) {
      const key = dayKey(r.time);
      const last = groups[groups.length - 1];
      if (last && last.day === key) last.rows.push(r);
      else groups.push({ day: key, rows: [r] });
    }
    return groups;
  }, [rows]);

  const events = useMemo(() => deriveEvents(rows), [rows]);

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        time: r.time,
        sunAz: r.sun?.azimuth_deg ?? null,
        sunEl: r.sun?.elevation_deg ?? null,
        earthAz: r.earth?.azimuth_deg ?? null,
        earthEl: r.earth?.elevation_deg ?? null,
        powerW: r.solar_power_w,
      })),
    [rows],
  );

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Mission Timeline"
        subtitle={
          selectedSite
            ? `${selectedSite.name} · ${win.start} → ${win.stop} UT · step ${win.step}`
            : "No site selected"
        }
        actions={
          <Button variant="outline" size="sm" onClick={reload} disabled={!selectedSlug}>
            Refresh
          </Button>
        }
      />

      <TimeControls />

      {!selectedSlug ? (
        <EmptyState message="Select a landing site to build the mission timeline." />
      ) : null}

      {loading ? <LoadingState label="Assembling the chronological timeline…" /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {data ? (
        <>
          {/* Summary strip */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Window"
              value={`${win.start} → ${win.stop}`}
              hint={`step ${win.step} · ${data.illumination_summary.samples} samples`}
            />
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
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Window span"
              value={num(data.window.interval_h, 2)}
              unit="h"
              hint={`start ${data.window.start_utc}`}
            />
            <Stat label="Stop (UT)" value={data.window.stop_utc} />
            <Stat
              label="Total estimated energy"
              value={num(data.solar_summary.energy_wh, 1)}
              unit="Wh"
              hint="estimate — not a flight power budget"
              accent="#FBBF24"
            />
            <Stat
              label="Timeline samples"
              value={data.window.samples ?? rows.length}
              hint={`step ${data.window.step}`}
            />
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-lunanav-gold" /> Sun &amp; Earth apparent angles
                </CardTitle>
                <Badge variant="muted" className="font-mono">
                  JPL Horizons · QUANTITIES=4
                </Badge>
              </CardHeader>
              <CardContent>
                <AzElChart data={chartData} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-lunanav-gold" /> Estimated solar power
                </CardTitle>
                <Badge variant="muted" className="font-mono">
                  array estimate
                </Badge>
              </CardHeader>
              <CardContent>
                <PowerChart data={chartData} />
              </CardContent>
            </Card>
          </div>

          {/* Vertical timeline grouped by day */}
          <Card>
            <CardHeader>
              <CardTitle>Chronological samples</CardTitle>
            </CardHeader>
            <CardContent>
              {grouped.length === 0 ? (
                <EmptyState message="The analysis returned no timeline rows." />
              ) : (
                <div className="space-y-4">
                  {grouped.map((group) => (
                    <div key={group.day}>
                      <div className="mono-label mb-1">{group.day}</div>
                      <div className="relative space-y-0.5 border-l border-lunanav-line pl-4">
                        {group.rows.map((r) => (
                          <div
                            key={r.time}
                            className="grid grid-cols-[92px_repeat(3,minmax(58px,1fr))_auto] items-center gap-2 border-b border-lunanav-line/40 py-1.5 last:border-0"
                          >
                            <span className="relative font-mono text-xs text-lunanav-white">
                              <span className="absolute -left-[21px] top-1.5 h-1.5 w-1.5 rounded-full bg-lunanav-gold/70" />
                              {fmtTime(r.time)}
                            </span>
                            <span className="font-mono text-[11px] text-lunanav-muted">
                              Sun el {num(r.sun?.elevation_deg, 1, "°")}
                            </span>
                            <span className="font-mono text-[11px] text-lunanav-muted">
                              Earth el {num(r.earth?.elevation_deg, 1, "°")}
                            </span>
                            <span className="font-mono text-[11px] text-lunanav-white">
                              {num(r.solar_power_w, 1, " W")}
                            </span>
                            <span className="flex items-center gap-3 text-[10px] text-lunanav-muted">
                              <span className="flex items-center gap-1">
                                <Dot state={r.illumination.illuminated} /> lit
                              </span>
                              <span className="flex items-center gap-1">
                                <Dot state={r.earth_link.terrain_visible} /> earth
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Derived mission events */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Mission events</CardTitle>
              <Badge variant="muted">derived from the analysed samples</Badge>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <EmptyState message="No mission events could be derived from the returned samples." />
              ) : (
                <ul className="space-y-1.5">
                  {events.map((e, i) => (
                    <li key={`${e.label}-${i}`} className="flex flex-wrap items-baseline gap-2 text-xs">
                      <span className="text-lunanav-muted">{e.label}:</span>
                      <span className="font-mono text-lunanav-white">{e.value}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-lunanav-muted">
                These events are computed strictly from the sampled timeline rows shown above — they are
                not interpolated between samples and no events are invented where the data does not
                support them. Times are sample endpoints in UT.
              </p>
            </CardContent>
          </Card>

          <Disclaimer text={DISCLAIMER} />
        </>
      ) : null}
    </div>
  );
}
