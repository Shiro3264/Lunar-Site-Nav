import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, Crosshair, ShieldCheck } from "lucide-react";

import {
  ConfidenceBadge,
  DataSourceTag,
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
import { Input } from "@/components/ui/input";
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
import { api } from "@/lib/api";
import { DASH, altitude as altText, latLon, num } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useApp } from "@/state/AppContext";

interface ValidationBody {
  latitude: number;
  longitude: number;
  label?: string;
  persist?: boolean;
  enrich_terrain?: boolean;
}

/** Wrap a longitude in degrees into the [-180, 180] interval (East-positive). */
function wrapLongitude(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

export default function CoordinateSearch() {
  const { sites } = useApp();
  const navigate = useNavigate();

  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [label, setLabel] = useState("");
  const [persist, setPersist] = useState(false);
  const [errors, setErrors] = useState<{ latitude?: string; longitude?: string }>({});
  const [body, setBody] = useState<ValidationBody | null>(null);
  const [effective, setEffective] = useState<{ latitude: number; longitude: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const validation = useAsync(
    () => (body ? api.validateCoordinate(body) : Promise.resolve(null)),
    [body],
    { enabled: body !== null },
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: { latitude?: string; longitude?: string } = {};
    const latNum = Number(lat);
    const lonNum = Number(lon);

    if (lat.trim() === "" || Number.isNaN(latNum)) {
      nextErrors.latitude = "Enter a latitude in degrees.";
    } else if (latNum < -90 || latNum > 90) {
      nextErrors.latitude = "Latitude must be within [-90, 90]° (selenographic).";
    }
    if (lon.trim() === "" || Number.isNaN(lonNum)) {
      nextErrors.longitude = "Enter a longitude in degrees.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setNotice(null);
    setBody({
      latitude: latNum,
      longitude: lonNum,
      label: label.trim() || undefined,
      persist,
      enrich_terrain: true,
    });
  };

  const loadFromSite = (latitude: number, longitude: number, name: string) => {
    setLat(String(latitude));
    setLon(String(longitude));
    setLabel(name);
    setErrors({});
    setNotice(null);
  };

  const onAnalyze = () => {
    const normalised = validation.data?.normalised;
    const coord = normalised
      ? { latitude: normalised.latitude_deg, longitude: normalised.longitude_deg }
      : { latitude: Number(lat) || 0, longitude: wrapLongitude(Number(lon) || 0) };
    setEffective(coord);
    setNotice(
      `Effective coordinate ${latLon(coord.latitude, coord.longitude)} stored locally; opening Observer Perspective.`,
    );
    navigate("/observer");
  };

  const result = validation.data;
  const terrain = result?.terrain ?? null;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Coordinate Search"
        subtitle="Validate arbitrary selenographic coordinates, wrap the longitude and enrich with measured terrain."
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-lunanav-gold" />
              Input coordinates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="lat">Latitude (°, −90…90)</Label>
                  <Input
                    id="lat"
                    inputMode="decimal"
                    placeholder="-85.4"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="font-mono"
                  />
                  {errors.latitude ? (
                    <p className="text-[11px] text-red-300">{errors.latitude}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lon">Longitude (°, East-positive)</Label>
                  <Input
                    id="lon"
                    inputMode="decimal"
                    placeholder="31.7"
                    value={lon}
                    onChange={(e) => setLon(e.target.value)}
                    className="font-mono"
                  />
                  {errors.longitude ? (
                    <p className="text-[11px] text-red-300">{errors.longitude}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="label">Label (optional)</Label>
                  <Input
                    id="label"
                    placeholder="e.g. Sector A"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-3 pb-1">
                  <Switch id="persist" checked={persist} onCheckedChange={setPersist} />
                  <Label htmlFor="persist" className="normal-case tracking-normal">
                    Persist coordinate to the database
                  </Label>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={validation.loading}>
                  Validate &amp; enrich
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onAnalyze}
                  disabled={lat.trim() === "" || lon.trim() === ""}
                >
                  <Compass className="h-3.5 w-3.5" /> Analyze this coordinate
                </Button>
              </div>

              <p className="text-[11px] leading-relaxed text-lunanav-muted">
                Longitude is East-positive and wrapped into [−180°, 180°] by the server. Latitude must
                lie within [−90°, 90°] of the selenographic MEAN_ME frame.
              </p>
            </form>

            {notice ? (
              <div className="mt-4 rounded-md border border-lunanav-gold/40 bg-lunanav-gold/10 px-3 py-2 text-[11px] text-lunanav-gold">
                {notice}
              </div>
            ) : null}
            {effective ? (
              <div className="mt-2 font-mono text-[11px] text-lunanav-muted">
                Effective coordinate: {latLon(effective.latitude, effective.longitude)}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Candidate sites</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {sites.length === 0 ? (
              <EmptyState message="No candidate sites available." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>Lat / Lon</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sites.slice(0, 4).map((s) => (
                    <TableRow key={s.slug}>
                      <TableCell className="font-normal text-lunanav-white">{s.name}</TableCell>
                      <TableCell>{latLon(s.latitude, s.longitude, 3)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => loadFromSite(s.latitude, s.longitude, s.name)}
                        >
                          Use
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {validation.loading ? <LoadingState label="Validating coordinate and enriching terrain…" /> : null}
      {validation.error ? (
        <ErrorState message={validation.error} onRetry={validation.reload} />
      ) : null}

      {result ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-lunanav-gold" />
                Normalised coordinate
              </CardTitle>
              {result.saved ? (
                <Badge variant="success" className="font-mono">
                  saved #{result.saved.id}
                </Badge>
              ) : null}
            </CardHeader>
            <CardContent>
              <MetricRow label="Latitude" value={num(result.normalised.latitude_deg, 4, "°")} />
              <MetricRow
                label="Longitude (wrapped)"
                value={num(result.normalised.longitude_deg, 4, "°")}
              />
              <MetricRow
                label="Longitude convention"
                value={result.normalised.longitude_convention}
                mono={false}
              />
              <MetricRow
                label="East-positive"
                value={result.normalised.east_positive_longitude ? "yes" : "no"}
              />
              {result.saved ? (
                <MetricRow label="Saved label" value={result.saved.label} mono={false} />
              ) : null}
              <p className="mt-3 text-[11px] leading-relaxed text-lunanav-muted">{result.note}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Terrain context</CardTitle>
              {terrain ? <ConfidenceBadge confidence={terrain.confidence} /> : null}
            </CardHeader>
            <CardContent>
              {terrain ? (
                <>
                  <div className="grid gap-x-6 sm:grid-cols-2">
                    <MetricRow label="Elevation" value={altText(terrain.elevation_m)} />
                    <MetricRow label="Slope" value={num(terrain.slope_deg, 2, "°")} />
                    <MetricRow label="Aspect" value={num(terrain.aspect_deg, 1, "°")} />
                    <MetricRow label="Roughness (RMS)" value={num(terrain.roughness_rms_m, 2, " m")} />
                    <MetricRow label="Local relief" value={num(terrain.local_relief_m, 1, " m")} />
                    <MetricRow
                      label="Resolution"
                      value={terrain.resolution_m ? `${terrain.resolution_m} m` : DASH}
                    />
                    <MetricRow label="Dataset" value={terrain.dataset} />
                    <MetricRow label="Source" value={terrain.source} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <DataSourceTag source={terrain.source} />
                    <Badge variant={terrain.available ? "success" : "warn"} className="font-mono">
                      {terrain.available ? "available" : "unavailable"}
                    </Badge>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-lunanav-muted">{terrain.note}</p>
                </>
              ) : (
                <EmptyState message="No terrain context returned for this coordinate." />
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Disclaimer text="Coordinates are selenographic MEAN_ME with East-positive longitude. Terrain metrics are reported only where measured data exists and are otherwise left undefined — never fabricated." />
    </div>
  );
}
