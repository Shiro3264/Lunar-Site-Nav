/**
 * Landing hero: text, the scientific 3D scene, reticle callouts and the UTC
 * status strip — a React port of the original `.hero` section with all live
 * values wired to real data.
 */
import type { RefObject } from "react";

import type { AnalysisResult, Site } from "@/lib/api";
import { HeroScene } from "@/landing/HeroScene";
import { useUtcClock } from "@/landing/hooks";

interface HeroProps {
  heroRef: RefObject<HTMLElement>;
  crosshairRef: RefObject<HTMLDivElement>;
  sites: Site[];
  selectedSite: Site | null;
  selectedSlug: string | null;
  onSelectSite: (slug: string) => void;
  analysis: AnalysisResult | null;
  analysisLoading: boolean;
  analysisError: string | null;
  sunScene: [number, number, number] | null;
  earthScene: [number, number, number] | null;
  subsolarLatLon: [number, number] | null;
  subearthLatLon: [number, number] | null;
  reducedMotion: boolean;
  onExplore: () => void;
}

export function Hero({
  heroRef,
  crosshairRef,
  sites,
  selectedSite,
  selectedSlug,
  onSelectSite,
  analysis,
  analysisLoading,
  analysisError,
  sunScene,
  earthScene,
  subsolarLatLon,
  subearthLatLon,
  reducedMotion,
  onExplore,
}: HeroProps) {
  const clock = useUtcClock();

  const status = analysisLoading
    ? "Loading ephemeris…"
    : analysisError
      ? "Ephemeris unavailable"
      : analysis
        ? "Live ephemeris · JPL Horizons"
        : "Awaiting site selection";

  const markerLatLon: [number, number] | null = selectedSite
    ? [selectedSite.latitude, selectedSite.longitude]
    : null;

  return (
    <section className="hero" id="home" data-section ref={heroRef}>
      <div className="hero-text">
        <p className="label">Lunar South Pole · Mission Planning</p>
        <h1>Navigate the Moon&apos;s most challenging landscapes.</h1>
        <p className="lead">
          Evaluate lunar landing sites by visualizing sunlight availability and direct-to-Earth
          communication conditions.
        </p>
        <div className="btns">
          <button className="btn btn-gold" type="button" onClick={onExplore}>
            Explore the Navigator <i className="arr">→</i>
          </button>
          <a className="btn btn-ghost" href="#how">
            View How It Works
          </a>
        </div>
      </div>

      <div className="hero-visual" id="heroVisual">
        <HeroScene
          sites={sites}
          selectedSlug={selectedSlug}
          onSelect={onSelectSite}
          sunScene={sunScene}
          earthScene={earthScene}
          subsolarLatLon={subsolarLatLon}
          subearthLatLon={subearthLatLon}
          showGraticule
          markerLatLon={markerLatLon}
          crosshairRef={crosshairRef}
          reducedMotion={reducedMotion}
        />

        <svg className="reticle" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="rt-ring" cx="50" cy="50" r="46" />
          <circle className="rt-ticks" cx="50" cy="50" r="48.6" />
          <path className="rt-cross" d="M50 .5v4M50 95.5v4M.5 50h4M95.5 50h4" />
        </svg>

        <div className="cl c1">
          <b>Lunar South Pole</b>
          <span>Region of interest</span>
        </div>
        <div className="cl c3">
          <b>Solar Visibility</b>
          <span>Sun vs. local horizon</span>
        </div>
        <div className="cl c4">
          <b>Earth Communication</b>
          <span>Earth vs. local horizon</span>
        </div>
        <div className="cl c5">
          <b>Mission Analysis</b>
          <span>Interface concept</span>
        </div>

        <div className="xhair" id="xhair" ref={crosshairRef} aria-hidden="true">
          <svg viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="11" />
            <path d="M22 2v12M22 30v12M2 22h12M30 22h12" />
          </svg>
          <div className="cl c2">
            <b>{selectedSite ? selectedSite.name : "Select a site"}</b>
            <span>
              {selectedSite
                ? `${selectedSite.latitude.toFixed(2)}°, ${selectedSite.longitude.toFixed(2)}°`
                : "Coordinate-based marker"}
            </span>
          </div>
        </div>

        {(analysisLoading || analysisError) && (
          <p className="label" role="status" style={{ position: "absolute", left: 0, bottom: "6%" }}>
            {analysisLoading ? "Fetching real ephemeris…" : `Ephemeris unavailable: ${analysisError}`}
          </p>
        )}
      </div>

      <div className="hud" aria-label="Interface status">
        <span>
          <i>UTC</i>
          <b>{clock}</b>
        </span>
        <span>
          <i>Region</i>
          <b>Lunar South Pole</b>
        </span>
        <span>
          <i>Reference frame</i>
          <b>Body-fixed (selenographic)</b>
        </span>
        <span>
          <i>Data basis</i>
          <b>NASA · JPL · LRO</b>
        </span>
        <span>
          <i>Status</i>
          <b>{status}</b>
        </span>
      </div>
    </section>
  );
}
