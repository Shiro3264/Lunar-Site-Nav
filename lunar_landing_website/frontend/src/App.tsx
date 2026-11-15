import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { TooltipProvider } from "@/components/ui/tooltip";

import LandingPage from "@/landing/LandingPage";
import Dashboard from "@/pages/Dashboard";
import Navigator3D from "@/pages/Navigator3D";
import SiteExplorer from "@/pages/SiteExplorer";
import CoordinateSearch from "@/pages/CoordinateSearch";
import RotationSimulator from "@/pages/RotationSimulator";
import ObserverPerspective from "@/pages/ObserverPerspective";
import SunlightShadow from "@/pages/SunlightShadow";
import EarthCommunication from "@/pages/EarthCommunication";
import SolarEnergy from "@/pages/SolarEnergy";
import SiteComparison from "@/pages/SiteComparison";
import SuitabilityRanking from "@/pages/SuitabilityRanking";
import MissionTimeline from "@/pages/MissionTimeline";
import ScientificValidation from "@/pages/ScientificValidation";
import MissionReports from "@/pages/MissionReports";
import Settings from "@/pages/Settings";

/** Application layout: every tool page renders inside the sidebar shell. */
function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export default function App() {
  return (
    <TooltipProvider delayDuration={150}>
      <Routes>
        {/* Public marketing landing page (the migrated prototype). */}
        <Route path="/" element={<LandingPage />} />

        {/* Application tools. */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/navigator" element={<Navigator3D />} />
          <Route path="/sites" element={<SiteExplorer />} />
          <Route path="/sites/:slug" element={<SiteExplorer />} />
          <Route path="/coordinates" element={<CoordinateSearch />} />
          <Route path="/rotation" element={<RotationSimulator />} />
          <Route path="/observer" element={<ObserverPerspective />} />
          <Route path="/sunlight" element={<SunlightShadow />} />
          <Route path="/earth-comms" element={<EarthCommunication />} />
          <Route path="/solar" element={<SolarEnergy />} />
          <Route path="/compare" element={<SiteComparison />} />
          <Route path="/ranking" element={<SuitabilityRanking />} />
          <Route path="/timeline" element={<MissionTimeline />} />
          <Route path="/validation" element={<ScientificValidation />} />
          <Route path="/reports" element={<MissionReports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </TooltipProvider>
  );
}
