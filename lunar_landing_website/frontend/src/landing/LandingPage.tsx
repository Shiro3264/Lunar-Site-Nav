/**
 * LunaNav landing page — the React + Vite + TypeScript port of the original
 * single-file prototype (`LunaNav-single (3).html`), mounted at `/`.
 *
 * What is preserved from the prototype:
 *  - logo/brand mark, colour palette, typography, navigation structure,
 *    visual storytelling and every content section (`#home`…`#launch`);
 *  - the theme switcher, UTC clock, drifting starfield, scroll-reveal and
 *    pointer-tilt micro-interactions (re-implemented as hooks);
 *  - the responsive layout and `prefers-reduced-motion` behaviour.
 *
 * What is upgraded:
 *  - the procedural Moon is replaced by the shared scientific globe
 *    ({@link HeroScene} → {@link LunarGlobe}) with a real terrain pipeline
 *    behind it;
 *  - the hardcoded marker becomes a coordinate-based selection driven by the
 *    selected landing site;
 *  - Earth and the Sun are positioned/illuminated from real JPL Horizons
 *    ephemeris (via the backend) instead of fixed points;
 *  - every dashboard value and the timeline bars come from the Django REST
 *    API with explicit loading / error / empty states;
 *  - the placeholder "coming soon" dialog is replaced by real router
 *    navigation into the application.
 *
 * This component performs no measurement of its own: it only renders what the
 * backend's data endpoints return and labels anything else as illustrative.
 */
import { useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";

import "@/styles/lunanav-landing.css";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { useApp } from "@/state/AppContext";
import { siteScenePosition, type Vec3 } from "@/three/coords";

import { DashboardPreview } from "@/landing/DashboardPreview";
import { Footer } from "@/landing/Footer";
import { Hero } from "@/landing/Hero";
import { NavBar } from "@/landing/NavBar";
import { Starfield } from "@/landing/Starfield";
import {
  useActiveSection,
  useAnchorScroll,
  useHeroHeightVar,
  useReducedMotion,
  useRevealObserver,
  useSolidNav,
  useTheme,
} from "@/landing/hooks";
import { Challenge, Cta, Features, HowItWorks, Technology, Why } from "@/landing/sections";

/** Selenographic sub-point → unit scene-frame direction (Three.js axes). */
function subPointToSceneDir(ll: [number, number] | null): Vec3 | null {
  if (!ll) return null;
  return siteScenePosition(ll[0], ll[1], 1);
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { theme, toggle, animating } = useTheme();
  const reducedMotion = useReducedMotion();

  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);

  const {
    sites,
    selectedSlug,
    setSelectedSlug,
    selectedSite,
    window: timeWindow,
    reloadSites,
  } = useApp();

  // --- Ported prototype behaviours (nav, reveal, theme, anchors) ----------- //
  const solid = useSolidNav(40);
  const activeId = useActiveSection(rootRef);
  useRevealObserver(rootRef);
  useHeroHeightVar(rootRef, heroRef);
  useAnchorScroll(rootRef);

  // --- Live data --------------------------------------------------------- //
  // Full site analysis (ephemeris + terrain horizon + suitability) for the
  // selected site over the shared mission window.
  const analysis = useAsync(
    () =>
      api.analyze({
        site_slug: selectedSlug ?? undefined,
        start: timeWindow.start,
        stop: timeWindow.stop,
        step: timeWindow.step,
        persist: false,
      }),
    [selectedSlug, timeWindow.start, timeWindow.stop, timeWindow.step],
    { enabled: Boolean(selectedSlug) },
  );

  // Sub-solar / sub-Earth points give the true centre→body directions used for
  // the globe's lighting and the Earth's position.
  const subPoints = useAsync(
    () => api.subPoints({ start: timeWindow.start, stop: timeWindow.stop, step: timeWindow.step }),
    [timeWindow.start, timeWindow.stop, timeWindow.step],
  );

  const rows = analysis.data?.timeline ?? analysis.data?.rows ?? [];

  const sunScene = useMemo<Vec3 | null>(
    () =>
      subPointToSceneDir(subPoints.data?.subsolar_lat_lon ?? null) ??
      rows[0]?.sun?.direction_scene ??
      null,
    [subPoints.data, rows],
  );
  const earthScene = useMemo<Vec3 | null>(
    () =>
      subPointToSceneDir(subPoints.data?.subearth_lat_lon ?? null) ??
      rows[0]?.earth?.direction_scene ??
      null,
    [subPoints.data, rows],
  );

  const windowLabel = `${timeWindow.start} → ${timeWindow.stop} UT`;

  // --- Navigation (replaces the prototype's placeholder dialog) ------------ //
  const goNavigator = useCallback(() => navigate("/navigator"), [navigate]);
  const goDashboard = useCallback(() => navigate("/dashboard"), [navigate]);

  const analysisReload = analysis.reload;
  const subPointsReload = subPoints.reload;
  const retry = useCallback(() => {
    void reloadSites();
    analysisReload();
    subPointsReload();
  }, [reloadSites, analysisReload, subPointsReload]);

  return (
    <div
      ref={rootRef}
      className={animating ? "lunanav-site theme-anim" : "lunanav-site"}
      data-theme={theme}
    >
      <Starfield />

      <NavBar
        solid={solid}
        activeId={activeId}
        theme={theme}
        onToggleTheme={toggle}
        onExplore={goNavigator}
      />

      <main>
        <Hero
          heroRef={heroRef}
          crosshairRef={crosshairRef}
          sites={sites}
          selectedSite={selectedSite}
          selectedSlug={selectedSlug}
          onSelectSite={setSelectedSlug}
          analysis={analysis.data}
          analysisLoading={analysis.loading}
          analysisError={analysis.error}
          sunScene={sunScene}
          earthScene={earthScene}
          subsolarLatLon={subPoints.data?.subsolar_lat_lon ?? null}
          subearthLatLon={subPoints.data?.subearth_lat_lon ?? null}
          reducedMotion={reducedMotion}
          onExplore={goNavigator}
        />

        <Challenge />
        <HowItWorks />
        <Features />

        <DashboardPreview
          analysis={analysis.data}
          loading={analysis.loading}
          error={analysis.error}
          site={selectedSite}
          windowLabel={windowLabel}
          onExplore={goDashboard}
          onRetry={retry}
        />

        <Why />
        <Technology />
        <Cta onExplore={goDashboard} />
      </main>

      <Footer />
    </div>
  );
}
