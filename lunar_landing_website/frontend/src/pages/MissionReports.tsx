import { useState, type FormEvent } from "react";
import { FileText, Trash2 } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, apiErrorMessage, http, type AnalysisReport } from "@/lib/api";
import { DASH, latLon } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useApp } from "@/state/AppContext";
import { cn } from "@/lib/utils";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
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
  if (!entries.length) return null;
  return (
    <div className="space-y-1">
      {entries.map(([k, v]) => (
        <MetricRow key={k} label={k} value={renderValue(v)} />
      ))}
    </div>
  );
}

function formatCreated(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value || DASH;
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UT`;
}

export default function MissionReports() {
  const { selectedSlug, selectedSite, window: win } = useApp();

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const list = useAsync(() => api.listReports(), []);
  const reports = list.data?.results ?? [];
  const selected = reports.find((r) => r.id === selectedId) ?? null;

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !selectedSlug || submitting) return;
    setSubmitting(true);
    setFormMsg(null);
    try {
      await api.generateReport({
        title: title.trim(),
        site_slug: selectedSlug,
        start: win.start,
        stop: win.stop,
        step: win.step,
        summary: summary.trim() || undefined,
      });
      setFormMsg({ kind: "success", text: "Report generated and saved." });
      setTitle("");
      setSummary("");
      list.reload();
    } catch (err) {
      setFormMsg({ kind: "error", text: apiErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    setFormMsg(null);
    try {
      await http.delete(`/api/reports/${id}/`);
      if (selectedId === id) setSelectedId(null);
      setFormMsg({ kind: "success", text: "Report deleted." });
      list.reload();
    } catch (err) {
      setFormMsg({ kind: "error", text: apiErrorMessage(err) });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Mission Reports"
        subtitle="Generate auditable snapshots of a live analysis and review the saved portfolio."
        actions={
          <Button variant="outline" size="sm" onClick={list.reload}>
            Refresh
          </Button>
        }
      />

      {/* ---------------- Generate form ---------------- */}
      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <FileText className="h-4 w-4 text-lunanav-gold" />
          <CardTitle>Generate report</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="report-title">Title (required)</Label>
                <Input
                  id="report-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Mons Mouton — 24 h illumination survey"
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="report-summary">Summary (optional)</Label>
                <Input
                  id="report-summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Short note to accompany this snapshot"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                size="sm"
                disabled={!selectedSlug || !title.trim() || submitting}
              >
                {submitting ? "Generating…" : "Submit"}
              </Button>
              <span className="font-mono text-[11px] text-lunanav-muted">
                {selectedSite
                  ? `${selectedSite.name} · ${win.start} → ${win.stop} UT · step ${win.step}`
                  : "No site selected"}
              </span>
            </div>

            {formMsg ? (
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-xs",
                  formMsg.kind === "success"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-red-500/40 bg-red-500/10 text-red-200",
                )}
              >
                {formMsg.text}
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {list.loading ? <LoadingState label="Loading saved reports…" /> : null}
      {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : null}

      {/* ---------------- Reports table ---------------- */}
      {!list.loading && !list.error ? (
        reports.length === 0 ? (
          <EmptyState message="No reports yet. Generate one above to capture an analysis snapshot." />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Saved reports</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Lat / Lon</TableHead>
                    <TableHead>Window (UT)</TableHead>
                    <TableHead>Step</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow
                      key={r.id}
                      className={cn(
                        "cursor-pointer",
                        selectedId === r.id && "bg-lunanav-gold/10",
                      )}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <TableCell className="text-lunanav-muted">{r.id}</TableCell>
                      <TableCell className="text-lunanav-white">{r.title}</TableCell>
                      <TableCell>{r.site_slug || DASH}</TableCell>
                      <TableCell>{latLon(r.latitude, r.longitude)}</TableCell>
                      <TableCell>
                        {r.window_start_utc || DASH} → {r.window_stop_utc || DASH}
                      </TableCell>
                      <TableCell>{r.step || DASH}</TableCell>
                      <TableCell>{formatCreated(r.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-300 hover:bg-red-500/10"
                          title="Delete report"
                          disabled={deletingId === r.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDelete(r.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      ) : null}

      {/* ---------------- Snapshot detail ---------------- */}
      {selected ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{selected.title}</CardTitle>
            <Badge variant="muted" className="font-mono">
              report #{selected.id}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {selected.summary ? (
              <p className="text-xs leading-relaxed text-lunanav-muted">{selected.summary}</p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricRow label="Site slug" value={selected.site_slug || DASH} />
              <MetricRow label="Lat / Lon" value={latLon(selected.latitude, selected.longitude)} />
              <MetricRow label="Window start" value={selected.window_start_utc || DASH} />
              <MetricRow label="Window stop" value={selected.window_stop_utc || DASH} />
              <MetricRow label="Step" value={selected.step || DASH} />
              <MetricRow label="Created" value={formatCreated(selected.created_at)} />
              <MetricRow label="Updated" value={formatCreated(selected.updated_at)} />
            </div>

            <Separator />

            <SnapshotBody report={selected} />

            <div>
              <div className="mono-label mb-1">Raw snapshot (JSON)</div>
              <pre className="max-h-80 overflow-auto rounded-md border border-lunanav-line bg-lunanav-navy/50 p-3 font-mono text-[11px] text-lunanav-silver">
                {JSON.stringify(selected.snapshot, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Disclaimer text="Reports capture a point-in-time snapshot of a live analysis. Values are traceable to a cited source or explicitly labelled as estimates; suitability scores are decision-support heuristics, not landing-success probabilities." />
    </div>
  );
}

function SnapshotBody({ report }: { report: AnalysisReport }) {
  const snap = report.snapshot ?? {};
  const sections: { title: string; data: Record<string, unknown> | null }[] = [
    { title: "Terrain", data: asRecord(snap.terrain) },
    { title: "Illumination summary", data: asRecord(snap.illumination_summary) },
    { title: "Solar summary", data: asRecord(snap.solar_summary) },
    { title: "Communication summary", data: asRecord(snap.communication_summary) },
    { title: "Suitability", data: asRecord(snap.suitability) },
    { title: "Provenance", data: asRecord(snap.provenance) },
  ];

  const present = sections.filter((s) => s.data !== null);
  if (!present.length) return <EmptyState message="This report has no structured snapshot." />;

  return (
    <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
      {present.map((s) => (
        <div key={s.title}>
          <div className="mono-label mb-1">{s.title}</div>
          <KeyValueTable data={s.data as Record<string, unknown>} />
        </div>
      ))}
    </div>
  );
}
