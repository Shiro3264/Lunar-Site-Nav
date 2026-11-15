import { useState, type ReactNode } from "react";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {navOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="h-full">
            <Sidebar onNavigate={() => setNavOpen(false)} />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setNavOpen(false)} />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenNav={() => setNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[1600px] animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
