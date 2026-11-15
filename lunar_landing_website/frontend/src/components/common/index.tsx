/**
 * Small shared presentational building blocks used across the application.
 */
import type { ReactNode } from "react";
import { AlertTriangle, Info, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DASH } from "@/lib/format";

export function SectionHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-lunanav-white">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-lunanav-muted">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  hint,
  accent,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  accent?: string;
  className?: string;
}) {
  return (
    <Card className={cn("p-3", className)}>
      <div className="mono-label">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="stat-value" style={accent ? { color: accent } : undefined}>
          {value === null || value === undefined ? DASH : value}
        </span>
        {unit ? <span className="font-mono text-xs text-lunanav-muted">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-1 text-[11px] leading-snug text-lunanav-muted">{hint}</div> : null}
    </Card>
  );
}

export function MetricRow({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-lunanav-line/60 py-1.5 last:border-0">
      <span className="text-xs text-lunanav-muted">{label}</span>
      <span className={cn("text-right text-xs text-lunanav-white", mono && "font-mono")}>{value}</span>
    </div>
  );
}

export function LoadingState({ label = "Loading scientific data…" }: { label?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs text-lunanav-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-lunanav-gold" />
        {label}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex items-start gap-3 border-red-500/30 bg-red-500/5 p-4">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
      <div className="flex-1">
        <div className="text-sm font-medium text-red-200">Unable to load data</div>
        <div className="mt-1 font-mono text-xs text-lunanav-muted">{message}</div>
      </div>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="rounded border border-lunanav-line px-2 py-1 text-xs text-lunanav-silver hover:bg-white/5"
        >
          Retry
        </button>
      ) : null}
    </Card>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <Card className="p-6 text-center text-sm text-lunanav-muted">{message}</Card>
  );
}

export function Disclaimer({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border border-lunanav-line bg-white/[0.02] px-3 py-2",
        className,
      )}
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lunanav-muted" />
      <p className="text-[11px] leading-relaxed text-lunanav-muted">{text}</p>
    </div>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: string | null | undefined }) {
  const variant =
    confidence === "high" ? "success" : confidence === "low" ? "warn" : "muted";
  return <Badge variant={variant as never}>confidence: {confidence ?? "unknown"}</Badge>;
}

export function DataSourceTag({ source }: { source: string }) {
  const isMeasured = /LOLA/i.test(source);
  return (
    <Badge variant={isMeasured ? "success" : "muted"} className="font-mono">
      {isMeasured ? "measured" : "model"} · {source}
    </Badge>
  );
}
