/**
 * Landing "dashboard preview" section.
 *
 * The prototype showed a purely illustrative mockup with hardcoded demo values.
 * It is now driven by the live analysis: solar/Earth elevation, visibility and
 * the Sun/Earth timeline bars all come from the backend (which in turn queries
 * JPL Horizons + the LOLA-derived horizon). When no live data is available the
 * section falls back to the original visual with explicit "demo data" labelling
 * — it never presents fabricated numbers as measurements.
 */
import type { AnalysisResult, Site } from "@/lib/api";
import { DASH, num } from "@/lib/format";

interface DashboardPreviewProps {
  analysis: AnalysisResult | null;
  loading: boolean;
  error: string | null;
  site: Site | null;
  windowLabel: string;
  onExplore: () => void;
  onRetry: () => void;
}

function clampPct(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Map an elevation in [-90, 90]° onto a 0–100 % gauge fill. */
function elevationGauge(el: number | null | undefined): number | null {
  if (el === null || el === undefined || Number.isNaN(el)) return null;
  return clampPct(((el + 90) / 180) * 100);
}

/** Contiguous "true" runs → {left%, width%} bars over the sampled window. */
function segments(values: boolean[]): { left: number; width: number }[] {
  const out: { left: number; width: number }[] = [];
  let start = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i] && start === -1) start = i;
    const last = i === values.length - 1;
    if (start !== -1 && (!values[i] || last)) {
      const end = values[i] && last ? i : i - 1;
      out.push({
        left: (start / values.length) * 100,
        width: ((end - start + 1) / values.length) * 100,
      });
      start = -1;
    }
  }
  return out;
}

function Gauge({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <div className="gauge">
        <i style={{ ["--v" as string]: `${value ?? 0}%` }} />
      </div>
      <small>{value === null ? "unavailable" : "live"}</small>
    </div>
  );
}

export function DashboardPreview({
  analysis,
  loading,
  error,
  site,
  windowLabel,
  onExplore,
  onRetry,
}: DashboardPreviewProps) {
  const rows = analysis?.timeline ?? analysis?.rows ?? [];
  const first = rows[0] ?? null;
  const live = Boolean(analysis && rows.length);

  const sunEl = first?.sun?.elevation_deg ?? null;
  const earthEl = first?.earth?.elevation_deg ?? null;
  const sunVisible = first?.illumination?.illuminated ?? null;
  const earthVisible = first?.earth_link?.terrain_visible ?? first?.earth_link?.geometric_visible ?? null;

  const sunSegments = live ? segments(rows.map((r) => Boolean(r.sun?.center_above_geometric_horizon))) : [];
  const earthSegments = live
    ? segments(rows.map((r) => Boolean(r.earth_link?.geometric_visible)))
    : [];

  const demoBars = [
    [{ left: 5, width: 30 }, { left: 48, width: 35 }],
    [{ left: 20, width: 25 }, { left: 62, width: 22 }],
  ];

  const bars = live ? [sunSegments, earthSegments] : demoBars;

  return (
    <section className="sec alt" id="dashboard" data-section>
      <div className="wrap">
        <h2 className="rv">Complex lunar conditions. Clearer mission insights.</h2>
        <p className="sub rv">
          Live analysis from the mission dataset: Sun and Earth elevations, visibility and
          Sun/Earth windows are computed from JPL Horizons ephemerides and the LOLA-derived local
          horizon. Values update with the selected site and mission window.
        </p>

        <div className="dash rv" aria-label="Mission analysis dashboard">
          <div className="dash-top">
            <span className="label">Selected landing site</span>
            <span className="chip">{site ? site.name : "no site selected"}</span>
            <span className="chip">{windowLabel}</span>
            <span className="chip demo">
              {live ? "Live data · JPL Horizons" : "Illustrative demo data"}
            </span>
          </div>

          <div className="dash-body">
            <svg
              className="map"
              viewBox="0 0 300 260"
              role="img"
              aria-label="Stylized lunar surface map with landing-site marker"
            >
              <defs>
                <radialGradient id="mg" cx=".35" cy=".3">
                  <stop offset="0" stopColor="#8a929c" />
                  <stop offset="1" stopColor="#2a3340" />
                </radialGradient>
              </defs>
              <circle cx="150" cy="130" r="120" fill="url(#mg)" />
              <g fill="#1b232d" opacity=".6">
                <circle cx="110" cy="90" r="22" />
                <circle cx="190" cy="150" r="30" />
                <circle cx="130" cy="180" r="14" />
                <circle cx="200" cy="80" r="10" />
              </g>
              <g fill="none" stroke="currentColor" opacity=".5">
                <circle cx="110" cy="90" r="22" />
                <circle cx="190" cy="150" r="30" />
              </g>
              <circle
                cx="150"
                cy="130"
                r="120"
                fill="none"
                stroke="#D5B77A"
                opacity=".4"
                strokeDasharray="2 5"
              />
              <circle cx="150" cy="190" r="6" fill="#D5B77A" />
              <circle className="pulse" cx="150" cy="190" r="6" fill="none" stroke="#D5B77A" />
            </svg>

            <div className="stats">
              {loading ? (
                <div className="stat">
                  <span className="label">Analysis</span>
                  <b className="ok">Loading live data…</b>
                </div>
              ) : error ? (
                <div className="stat">
                  <span className="label">Analysis</span>
                  <b className="ok">Unavailable — {error}</b>
                  <small>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ marginTop: 10 }}
                      onClick={onRetry}
                    >
                      Retry
                    </button>
                  </small>
                </div>
              ) : !site ? (
                <div className="stat">
                  <span className="label">Analysis</span>
                  <b className="ok">No candidate sites available</b>
                </div>
              ) : (
                <>
                  <Gauge label="Solar elevation" value={elevationGauge(sunEl)} />
                  <Gauge label="Earth elevation" value={elevationGauge(earthEl)} />
                  <div className="stat">
                    <span className="label">Sun visibility</span>
                    <b className="ok">
                      {sunVisible === null
                        ? DASH
                        : sunVisible
                          ? "Illuminated"
                          : "In shadow"}
                    </b>
                  </div>
                  <div className="stat">
                    <span className="label">Earth visibility</span>
                    <b className="ok">
                      {earthVisible === null ? DASH : earthVisible ? "Line of sight" : "Obstructed"}
                    </b>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="tl">
            <span className="label">Mission timeline</span>
            <div className="row">
              <em>Sun</em>
              <div className="bar">
                {bars[0].map((b, i) => (
                  <i key={i} style={{ ["--l" as string]: `${b.left}%`, ["--w" as string]: `${b.width}%` }} />
                ))}
              </div>
            </div>
            <div className="row">
              <em>Earth</em>
              <div className="bar">
                {bars[1].map((b, i) => (
                  <i key={i} style={{ ["--l" as string]: `${b.left}%`, ["--w" as string]: `${b.width}%` }} />
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid var(--line)",
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button className="btn btn-gold btn-sm" type="button" onClick={onExplore}>
              Open full analysis
            </button>
            {analysis ? (
              <small style={{ font: "400 .7rem var(--fm)", color: "var(--muted)" }}>
                Suitability index {num(analysis.suitability.composite_score, 1)} ·{" "}
                {analysis.suitability.grade} · {analysis.suitability.disclaimer}
              </small>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
