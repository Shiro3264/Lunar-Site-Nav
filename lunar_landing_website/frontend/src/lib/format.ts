/** Formatting helpers for scientific values (never fabricate — render null as "—"). */

export const DASH = "—";

export function num(value: number | null | undefined, digits = 2, unit = ""): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  return `${value.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
}

export function pct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  return `${(value * 100).toFixed(digits)}%`;
}

export function altitude(value_m: number | null | undefined): string {
  if (value_m === null || value_m === undefined || Number.isNaN(value_m)) return DASH;
  return `${value_m.toLocaleString(undefined, { maximumFractionDigits: 0 })} m`;
}

export function bool(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  return value ? "Yes" : "No";
}

export function latLon(lat: number | null, lon: number | null, digits = 3): string {
  if (lat === null || lon === null) return DASH;
  const nsa = lat >= 0 ? "N" : "S";
  const ewa = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(digits)}°${nsa}  ${Math.abs(lon).toFixed(digits)}°${ewa}`;
}

export const GRADE_STYLES: Record<string, string> = {
  excellent: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  good: "text-lunanav-gold border-lunanav-gold/40 bg-lunanav-gold/10",
  moderate: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  marginal: "text-orange-300 border-orange-500/40 bg-orange-500/10",
  poor: "text-red-300 border-red-500/40 bg-red-500/10",
  insufficient_data: "text-lunanav-muted border-lunanav-line bg-white/5",
  unknown: "text-lunanav-muted border-lunanav-line bg-white/5",
};

export function gradeStyle(grade: string | null | undefined): string {
  if (!grade) return GRADE_STYLES.insufficient_data;
  return GRADE_STYLES[grade] ?? GRADE_STYLES.insufficient_data;
}

export const ACCESSIBILITY_STYLES: Record<string, string> = {
  excellent: "bg-emerald-500",
  good: "bg-lunanav-gold",
  low_elevation: "bg-amber-500",
  below_horizon: "bg-red-500",
  blocked_by_terrain: "bg-red-600",
  unknown: "bg-lunanav-muted",
};

/** Score 0–100 → a red→gold→green gradient colour for charts/gauges. */
export function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "#98A5B5";
  if (score >= 80) return "#34D399";
  if (score >= 65) return "#D5B77A";
  if (score >= 50) return "#FBBF24";
  if (score >= 35) return "#FB923C";
  return "#F87171";
}

export function hhmmToIsoInput(value: string): string {
  // "2026-11-15 00:00" -> "2026-11-15T00:00"
  return value.replace(" ", "T");
}

export function isoInputToApi(value: string): string {
  return value.replace("T", " ");
}
