import { useEffect, useRef, useState, type ReactNode } from "react";
import { Trophy } from "lucide-react";

import { ComparisonBars } from "@/components/charts";
import {
  Disclaimer,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
} from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, type ComparedSite, type Site } from "@/lib/api";
import { DASH, altitude as altText, gradeStyle, num, pct } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useApp } from "@/state/AppContext";

const SUBSCORE_KEYS = ["illumination", "terrain", "communication"] as const;

function subScore(site: ComparedSite, key: string): number | null {
  return site.suitability.sub_scores.find((s) => s.key === key)?.score ?? null;
}

export default function SiteComparison() {
  const { sites, window: win } = useApp();

  const [selected, setSelected] = useState<string[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && sites.length > 0) {
      setSelected(sites.map((s) => s.slug));
      initialized.current = true;
    }
  }, [sites]);

  function toggle(slug: string) {
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  const selectionKey = selected.join("|");
  const { data, loading, error, reload } = useAsync(
    () =>
      api.compareSites({
        sites: selected.map((slug) => ({ slug })),
        start: win.start,
        stop: win.stop,
        step: win.step,
      }),
    [selectionKey, win.start, win.stop, win.step],
    { enabled: selected.length > 0 },
  );

  const erroredSites = (data?.sites ?? []).filter((s) => s.error);

  const chartData = (data?.sites ?? []).map((s) => ({
    name: s.name,
    composite: s.error ? null : s.suitability.composite_score,
    illumination: s.error ? null : subScore(s, "illumination"),
    terrain: s.error ? null : subScore(s, "terrain"),
    communication: s.error ? null : subScore(s, "communication"),
  }));

  const metrics: { label: string; render: (s: ComparedSite) => ReactNode }[] = [
    { label: "Composite score", render: (s) => (s.error ? DASH : num(s.suitability.composite_score, 1)) },
    {
      label: "Grade",
      render: (s) =>
        s.error ? (
          <Badge variant="muted">{DASH}</Badge>
        ) : (
          <Badge className={`capitalize ${gradeStyle(s.suitability.grade)}`}>
            {s.suitability.grade.replace(/_/g, " ")}
          </Badge>
        ),
    },
    { label: "Elevation", render: (s) => (s.error ? DASH : altText(s.terrain.elevation_m)) },
    { label: "Slope", render: (s) => (s.error ? DASH : num(s.terrain.slope_deg, 2, "°")) },
    {
      label: "Illuminated fraction",
      render: (s) => (s.error ? DASH : pct(s.illumination_summary.illuminated_fraction)),
    },
    {
      label: "Longest darkness",
      render: (s) => (s.error ? DASH : num(s.illumination_summary.longest_continuous_darkness_h, 2, "h")),
    },
    {
      label: "Earth terrain access",
      render: (s) => (s.error ? DASH : pct(s.communication_summary.terrain_fraction)),
    },
    { label: "Peak power", render: (s) => (s.error ? DASH : num(s.solar_summary.peak_power_w, 1, "W")) },
    { label: "Solar energy", render: (s) => (s.error ? DASH : num(s.solar_summary.energy_wh, 1, "Wh")) },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Landing Site Comparison"
        subtitle={`${win.start} → ${win.stop} UT · step ${win.step}`}
        actions={
          <Button variant="outline" size="sm" onClick={reload} disabled={selected.length === 0}>
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Select sites to compare</CardTitle>
          <p className="text-xs text-lunanav-muted">
            Toggle candidate landing sites; each is analysed over the shared time window.
          </p>
        </CardHeader>
        <CardContent>
          {sites.length === 0 ? (
            <p className="text-xs text-lunanav-muted">No candidate sites returned by the API.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {sites.map((s: Site) => (
                <div key={s.slug} className="flex items-center justify-between gap-3">
                  <Label htmlFor={`cmp-${s.slug}`} className="normal-case text-lunanav-silver">
                    {s.name}
                  </Label>
                  <Switch
                    id={`cmp-${s.slug}`}
                    checked={selected.includes(s.slug)}
                    onCheckedChange={() => toggle(s.slug)}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected.length === 0 ? (
        <EmptyState message="Select at least one site to run the comparison." />
      ) : null}

      {loading ? <LoadingState label="Comparing landing sites…" /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {data && data.sites.length > 0 ? (
        <>
          {erroredSites.length > 0 ? (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardContent className="space-y-1 p-3">
                {erroredSites.map((s) => (
                  <div key={s.slug ?? s.name} className="font-mono text-xs text-red-200">
                    {s.name}: {s.error}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Suitability contribution by site</CardTitle>
            </CardHeader>
            <CardContent>
              <ComparisonBars data={chartData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Side-by-side comparison</CardTitle>
              <p className="text-xs text-lunanav-muted">{data.count} sites · {SUBSCORE_KEYS.length} sub-score dimensions</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    {data.sites.map((s) => (
                      <TableHead key={s.slug ?? s.name}>
                        <div className="text-lunanav-silver">{s.name}</div>
                        <div className="text-[10px] font-normal lowercase text-lunanav-muted">
                          {s.slug ?? DASH}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((m) => (
                    <TableRow key={m.label}>
                      <TableCell className="text-lunanav-muted">{m.label}</TableCell>
                      {data.sites.map((s) => (
                        <TableCell key={`${s.slug ?? s.name}-${m.label}`}>
                          {m.render(s)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="text-lunanav-muted">Status</TableCell>
                    {data.sites.map((s) => (
                      <TableCell key={`${s.slug ?? s.name}-status`}>
                        {s.error ? (
                          <Badge variant="danger">error</Badge>
                        ) : (
                          <Badge variant="success">ok</Badge>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-lunanav-gold" /> Ranking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ol className="space-y-1.5">
                {data.ranking.map((name, i) => (
                  <li key={name} className="flex items-center gap-3 text-sm">
                    <span className="font-mono text-xs text-lunanav-muted">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-display text-lunanav-white">{name}</span>
                  </li>
                ))}
              </ol>
              <Disclaimer text={data.disclaimer} />
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
