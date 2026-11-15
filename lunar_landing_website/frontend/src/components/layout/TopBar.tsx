import { useEffect, useState } from "react";
import { Activity, Menu, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, type HealthStatus } from "@/lib/api";
import { hhmmToIsoInput, isoInputToApi } from "@/lib/format";
import { useApp } from "@/state/AppContext";

const STEP_OPTIONS = ["30 m", "1 h", "3 h", "6 h", "12 h", "1 d"];

export function TopBar({ onOpenNav }: { onOpenNav?: () => void }) {
  const { sites, selectedSlug, setSelectedSlug, window: win, setWindow, resetWindow } = useApp();
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-lunanav-line bg-lunanav-navy/70 px-4 py-2.5 backdrop-blur">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenNav}>
        <Menu className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-2">
        <Label htmlFor="site-select">Site</Label>
        <Select value={selectedSlug ?? undefined} onValueChange={setSelectedSlug}>
          <SelectTrigger id="site-select" className="h-8 w-52 text-xs">
            <SelectValue placeholder="Select a site…" />
          </SelectTrigger>
          <SelectContent>
            {sites.map((s) => (
              <SelectItem key={s.slug} value={s.slug}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="hidden items-center gap-2 md:flex">
        <Label htmlFor="win-start">Start (UT)</Label>
        <Input
          id="win-start"
          type="datetime-local"
          className="h-8 w-44 text-xs"
          value={hhmmToIsoInput(win.start)}
          onChange={(e) => setWindow({ start: isoInputToApi(e.target.value) })}
        />
        <Label htmlFor="win-stop">Stop (UT)</Label>
        <Input
          id="win-stop"
          type="datetime-local"
          className="h-8 w-44 text-xs"
          value={hhmmToIsoInput(win.stop)}
          onChange={(e) => setWindow({ stop: isoInputToApi(e.target.value) })}
        />
        <Select value={win.step} onValueChange={(v) => setWindow({ step: v })}>
          <SelectTrigger className="h-8 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STEP_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetWindow} title="Reset window">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Badge variant={health?.integrations.spice.available ? "success" : "warn"} className="font-mono">
          SPICE {health?.integrations.spice.available ? "ok" : "fallback"}
        </Badge>
        <Badge
          variant={
            (health?.integrations.lola_dem as { available?: boolean } | undefined)?.available
              ? "success"
              : "muted"
          }
          className="hidden font-mono sm:inline-flex"
        >
          DEM{" "}
          {(health?.integrations.lola_dem as { available?: boolean } | undefined)?.available
            ? "measured"
            : "unavailable"}
        </Badge>
        <Badge variant={health ? "default" : "muted"} className="gap-1 font-mono">
          <Activity className="h-3 w-3" />
          {health ? "API online" : "API offline"}
        </Badge>
      </div>
    </header>
  );
}
