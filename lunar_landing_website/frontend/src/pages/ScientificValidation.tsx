import { ExternalLink } from "lucide-react";

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
import { DASH, num } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";

// --------------------------------------------------------------------------- //
// Defensive narrowing helpers — meta()/terrainDataset() are Record<string, unknown>.
// --------------------------------------------------------------------------- //
function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asRecordArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v)
    ? v.map((item) => asRecord(item)).filter((x): x is Record<string, unknown> => x !== null)
    : [];
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => renderValue(x)) : [];
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return DASH;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function KeyValueTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (!entries.length) return <EmptyState message="No fields returned." />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-1/3">Key</TableHead>
          <TableHead>Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map(([k, v]) => (
          <TableRow key={k}>
            <TableCell className="text-lunanav-muted">{k}</TableCell>
            <TableCell className="break-all text-lunanav-white">{renderValue(v)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function ScientificValidation() {
  const health = useAsync(() => api.health(), []);
  const meta = useAsync(() => api.meta(), []);
  const terrain = useAsync(() => api.terrainDataset(), []);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Scientific Data &amp; Validation"
        subtitle="Provenance, live integration status and the reference fixtures the backend test suite asserts against."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                health.reload();
                meta.reload();
                terrain.reload();
              }}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* ---------------- Health ---------------- */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Integration health</CardTitle>
          <Badge variant="muted" className="font-mono">
            GET /api/health/
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {health.loading ? <LoadingState label="Probing integrations…" /> : null}
          {health.error ? <ErrorState message={health.error} onRetry={health.reload} /> : null}
          {health.data ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat
                  label="Service status"
                  value={
                    <Badge variant={health.data.status === "ok" ? "success" : "warn"}>
                      {health.data.status}
                    </Badge>
                  }
                />
                <Stat label="Version" value={health.data.version} />
                <Stat label="Server time (UT)" value={health.data.time_utc} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mono-label mb-1">Database</div>
                  <MetricRow label="Engine" value={health.data.database.engine || DASH} />
                  <MetricRow
                    label="Connected"
                    value={
                      <Badge variant={health.data.database.connected ? "success" : "danger"}>
                        {health.data.database.connected ? "yes" : "no"}
                      </Badge>
                    }
                  />
                </div>
                <div>
                  <div className="mono-label mb-1">SPICE</div>
                  <MetricRow
                    label="Available"
                    value={
                      <Badge variant={health.data.integrations.spice.available ? "success" : "warn"}>
                        {health.data.integrations.spice.available ? "yes" : "no"}
                      </Badge>
                    }
                  />
                  <MetricRow
                    label="Kernels"
                    value={String(health.data.integrations.spice.kernels.length)}
                  />
                  {health.data.integrations.spice.kernels.length ? (
                    <ul className="mt-1 space-y-0.5">
                      {health.data.integrations.spice.kernels.map((k) => (
                        <li key={k} className="font-mono text-[11px] text-lunanav-muted">
                          {k}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>

              <div>
                <div className="mono-label mb-1 flex items-center gap-2">
                  LOLA DEM status
                  <ConfidenceBadge
                    confidence={
                      health.data.integrations.lola_dem.available === true ? "high" : "low"
                    }
                  />
                </div>
                <KeyValueTable data={health.data.integrations.lola_dem} />
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* ---------------- Meta ---------------- */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Platform metadata</CardTitle>
          <Badge variant="muted" className="font-mono">
            GET /api/meta/
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {meta.loading ? <LoadingState label="Loading platform metadata…" /> : null}
          {meta.error ? <ErrorState message={meta.error} onRetry={meta.reload} /> : null}
          {meta.data ? <MetaBody meta={meta.data} /> : null}
        </CardContent>
      </Card>

      {/* ---------------- Terrain dataset ---------------- */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Terrain dataset</CardTitle>
          <Badge variant="muted" className="font-mono">
            GET /api/terrain/dataset/
          </Badge>
        </CardHeader>
        <CardContent>
          {terrain.loading ? <LoadingState label="Reading DEM dataset status…" /> : null}
          {terrain.error ? <ErrorState message={terrain.error} onRetry={terrain.reload} /> : null}
          {terrain.data ? (
            terrain.data.available === true ? (
              <div className="mb-3">
                <DataSourceTag source={renderValue(terrain.data.product)} />
              </div>
            ) : null
          ) : null}
          {terrain.data ? <KeyValueTable data={terrain.data} /> : null}
        </CardContent>
      </Card>

      {/* ---------------- Regression fixture ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Regression fixture — Moon-centred observer ephemeris</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[11px] leading-relaxed text-lunanav-muted">
            The backend test suite asserts the following known-good reference values for a
            Moon-centred observer ephemeris at epoch <span className="font-mono">2026-Nov-15 00:00 UT</span>.
            They are test-fixture reference values, not a live observation.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mono-label mb-1">SUN</div>
              <MetricRow label="Azimuth" value="82.878416°" />
              <MetricRow label="Elevation" value="2.132805°" />
              <MetricRow label="Visible" value="false" />
            </div>
            <div>
              <div className="mono-label mb-1">EARTH</div>
              <MetricRow label="Azimuth" value="325.743625°" />
              <MetricRow label="Elevation" value="0.247893°" />
              <MetricRow label="Visible" value="false" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Concept distinctions ---------------- */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Geometric horizon vs apparent visibility</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[11px] leading-relaxed text-lunanav-muted">
            <p>
              <span className="text-lunanav-white">Geometric horizon:</span> a body is above the horizon
              when its centre/limb elevation exceeds 0° ignoring terrain. Reported per-sample as
              geometric centre/limb flags.
            </p>
            <p>
              <span className="text-lunanav-white">Apparent-body visibility:</span> whether the body is
              visible at all to a Moon-centred observer, before any local obstruction is considered.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Terrain obstruction vs actual illumination</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[11px] leading-relaxed text-lunanav-muted">
            <p>
              <span className="text-lunanav-white">Terrain-obstructed visibility:</span> the local skyline
              (from LOLA DEM) is compared against the body elevation; a body above the geometric horizon
              may still be blocked by terrain.
            </p>
            <p>
              <span className="text-lunanav-white">Actual illumination:</span> only true when the Sun is
              above the terrain horizon; incidence angle and terrain-clearance are reported alongside.
            </p>
          </CardContent>
        </Card>
      </div>

      <Disclaimer
        text={
          `${DISCLAIMER} Missing values are returned as null and are rendered here as ${DASH} — they are ` +
          `never substituted with zero. Confidence badges reflect the underlying source quality ` +
          `(measured LOLA terrain = high; modelled/estimated values = lower).`
        }
      />
    </div>
  );
}

function MetaBody({ meta }: { meta: Record<string, unknown> }) {
  const branding = asRecord(meta.branding);
  const frames = asRecord(meta.frames);
  const dataSources = asRecordArray(meta.data_sources);
  const libraries = asRecord(meta.scientific_libraries);
  const runtime = asRecord(meta.runtime);
  const candidates = asRecordArray(meta.candidate_sites);
  const disclaimers = asStringArray(meta.disclaimers);

  return (
    <div className="space-y-5">
      {branding ? (
        <div>
          <div className="mono-label mb-1">Branding</div>
          <MetricRow label="Product" value={renderValue(branding.product)} mono={false} />
          <MetricRow label="Tagline" value={renderValue(branding.tagline)} mono={false} />
        </div>
      ) : null}

      {frames ? (
        <div>
          <div className="mono-label mb-1">Reference frames &amp; conventions</div>
          <MetricRow label="Body-fixed frame" value={renderValue(frames.body_fixed)} mono={false} />
          <MetricRow
            label="Longitude convention"
            value={renderValue(frames.longitude_convention)}
            mono={false}
          />
          <MetricRow
            label="Azimuth convention"
            value={renderValue(frames.azimuth_convention)}
            mono={false}
          />
          <MetricRow label="Shape model" value={renderValue(frames.shape_model)} mono={false} />
          <MetricRow label="Terrain datum" value={renderValue(frames.terrain_datum)} mono={false} />
        </div>
      ) : null}

      {dataSources.length ? (
        <div>
          <div className="mono-label mb-1">Data sources</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Use</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataSources.map((s, i) => {
                const url = renderValue(s.url);
                return (
                  <TableRow key={`${renderValue(s.name)}-${i}`}>
                    <TableCell className="text-lunanav-white">{renderValue(s.name)}</TableCell>
                    <TableCell>
                      {url !== DASH ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-lunanav-gold hover:underline"
                        >
                          {url.replace(/^https?:\/\//, "")}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        DASH
                      )}
                    </TableCell>
                    <TableCell className="whitespace-normal text-lunanav-muted">
                      {renderValue(s.use)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {libraries ? (
        <div>
          <div className="mono-label mb-1">Scientific libraries</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Library</TableHead>
                <TableHead>Version</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(libraries).map(([name, version]) => (
                <TableRow key={name}>
                  <TableCell className="text-lunanav-white">{name}</TableCell>
                  <TableCell>{renderValue(version)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {runtime ? (
        <div>
          <div className="mono-label mb-1">Runtime</div>
          <MetricRow label="Python" value={renderValue(runtime.python)} />
          <MetricRow label="Django" value={renderValue(runtime.django)} />
          <MetricRow label="DRF" value={renderValue(runtime.drf)} />
          <MetricRow label="Platform" value={renderValue(runtime.platform)} mono={false} />
        </div>
      ) : null}

      {candidates.length ? (
        <div>
          <div className="mono-label mb-1">Candidate sites</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Slug</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Lat</TableHead>
                <TableHead className="text-right">Lon</TableHead>
                <TableHead>Region</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((c, i) => (
                <TableRow key={`${renderValue(c.slug)}-${i}`}>
                  <TableCell className="text-lunanav-muted">{renderValue(c.slug)}</TableCell>
                  <TableCell className="text-lunanav-white">{renderValue(c.name)}</TableCell>
                  <TableCell className="text-right">
                    {num(typeof c.latitude === "number" ? c.latitude : null, 3, "°")}
                  </TableCell>
                  <TableCell className="text-right">
                    {num(typeof c.longitude === "number" ? c.longitude : null, 3, "°")}
                  </TableCell>
                  <TableCell className="whitespace-normal text-lunanav-muted">
                    {renderValue(c.region)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {disclaimers.length ? (
        <div>
          <div className="mono-label mb-1">Disclaimers</div>
          <ul className="space-y-1">
            {disclaimers.map((d, i) => (
              <li key={i} className="text-[11px] leading-relaxed text-lunanav-muted">
                • {d}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
