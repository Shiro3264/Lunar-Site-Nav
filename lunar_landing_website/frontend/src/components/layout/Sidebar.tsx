import { NavLink } from "react-router-dom";
import { Moon } from "lucide-react";

import { NAV_GROUPS, NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-lunanav-line bg-lunanav-navy/80">
      <div className="flex items-center gap-2.5 border-b border-lunanav-line px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-lunanav-gold/40 bg-lunanav-gold/10">
          <Moon className="h-5 w-5 text-lunanav-gold" />
        </div>
        <div className="leading-tight">
          <div className="font-display text-base font-bold tracking-tight text-lunanav-white">
            Luna<span className="text-lunanav-gold">Nav</span>
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-lunanav-muted">
            Lunar Site Navigator
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((i) => i.group === group);
          if (!items.length) return null;
          return (
            <div key={group} className="mb-3">
              <div className="px-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-lunanav-muted/80">
                {group}
              </div>
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/dashboard"}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-[13px] transition-colors",
                          isActive
                            ? "bg-lunanav-gold/10 text-lunanav-gold"
                            : "text-lunanav-silver/85 hover:bg-white/5 hover:text-lunanav-white",
                        )
                      }
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          "bg-current opacity-40",
                        )}
                      />
                      <span className="truncate">{item.short}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-lunanav-line px-4 py-3">
        <div className="font-mono text-[10px] leading-relaxed text-lunanav-muted">
          <div>JPL Horizons · NASA LOLA</div>
          <div>NAIF SPICE · DE440</div>
        </div>
      </div>
    </aside>
  );
}
