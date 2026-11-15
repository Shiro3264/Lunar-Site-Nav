/** Time-simulator controls shared by the analysis pages. */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TIME_PRESETS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useApp } from "@/state/AppContext";

function stepHours(step: string): number {
  const m = step.match(/^(\d+(?:\.\d+)?)\s*([smhd])$/i);
  if (!m) return 1;
  const v = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  return unit === "s" ? v / 3600 : unit === "m" ? v / 60 : unit === "h" ? v : v * 24;
}

export function TimeControls({ compact = false }: { compact?: boolean }) {
  const { window: win, shiftWindow, resetWindow, setWindow } = useApp();
  const [playing, setPlaying] = useState(false);
  const step = stepHours(win.step);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => shiftWindow(step), 900);
    return () => clearInterval(id);
  }, [playing, step, shiftWindow]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-md border border-lunanav-line bg-lunanav-navy/50 p-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Step backward"
          onClick={() => shiftWindow(-step)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title={playing ? "Pause" : "Play"}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Step forward"
          onClick={() => shiftWindow(step)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Reset to now"
          onClick={() => {
            setPlaying(false);
            resetWindow();
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {!compact ? (
        <div className="flex flex-wrap items-center gap-1">
          {TIME_PRESETS.map((p) => (
            <Button
              key={p.label}
              variant="outline"
              size="sm"
              className={cn("h-7 px-2 text-[11px]")}
              onClick={() => shiftWindow(p.hours)}
              title={`Shift window by ${p.hours} h`}
            >
              {p.label}
            </Button>
          ))}
        </div>
      ) : null}

      <span className="font-mono text-[11px] text-lunanav-muted">
        {win.start} → {win.stop} UT · step {win.step}
      </span>
      {compact ? null : (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => {
            const now = new Date();
            now.setUTCMinutes(0, 0, 0);
            const start = now.toISOString().slice(0, 16).replace("T", " ");
            const stopDate = new Date(now.getTime() + 24 * 3600 * 1000);
            setWindow({ start, stop: stopDate.toISOString().slice(0, 16).replace("T", " ") });
          }}
        >
          Set to now
        </Button>
      )}
    </div>
  );
}
