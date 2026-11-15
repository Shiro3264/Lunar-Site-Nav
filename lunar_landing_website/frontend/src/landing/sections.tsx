/**
 * Static landing content sections — Challenge, How It Works, Features, Why,
 * Technology and the closing CTA. Markup and copy are ported 1:1 from the
 * original prototype so the visual storytelling is preserved.
 */
import { useRef, type ReactNode } from "react";

import { prefersReducedMotion } from "@/landing/hooks";

/** Re-implements the prototype's `initTilt()` pointer-tilt on `.tilt` cards. */
function Tilt({ className = "", children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement | null>(null);

  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateY(-4px)`;
  };

  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "";
  };

  return (
    <article
      ref={ref as React.RefObject<HTMLElement>}
      className={`tilt rv ${className}`.trim()}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </article>
  );
}

export function Challenge() {
  return (
    <section className="sec" id="challenge" data-section>
      <div className="wrap">
        <h2 className="rv">Landing on the Moon is about more than location.</h2>
        <p className="sub rv">
          Future lunar missions, especially those targeting the Moon&apos;s South Pole, face
          challenging environmental conditions. Understanding sunlight availability and direct
          communication opportunities is essential when evaluating potential landing sites.
        </p>
        <div className="two">
          <article className="panel rv tilt">
            <svg
              className="art"
              viewBox="0 0 400 190"
              role="img"
              aria-label="Sun low on the lunar horizon with rays and elevation arc"
            >
              <circle cx="300" cy="120" r="26" fill="#D5B77A" />
              <g stroke="#D5B77A" strokeWidth="1.5" opacity=".6" className="rays">
                <path d="M300 78v-22M270 90l-14-14M330 90l14-14M258 120h-22M342 120h22" />
              </g>
              <path d="M0 150Q60 132 130 146T250 140 400 152V190H0z" fill="#1a2a44" />
              <path
                d="M0 150Q60 132 130 146T250 140 400 152"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M240 140a60 60 0 0 1 8-26"
                fill="none"
                stroke="currentColor"
                strokeDasharray="3 3"
              />
              <text x="214" y="112" fill="#98A5B5" fontFamily="IBM Plex Mono" fontSize="10">
                elev.
              </text>
            </svg>
            <p className="label">Solar visibility</p>
            <h3>Can the spacecraft access sunlight?</h3>
            <p>
              The Sun remains close to the lunar horizon near the South Pole. Craters, mountains,
              and long shadows can affect illumination and potential solar power availability.
            </p>
          </article>
          <article className="panel rv tilt">
            <svg
              className="art"
              viewBox="0 0 400 190"
              role="img"
              aria-label="Earth above the lunar horizon with communication signal lines"
            >
              <circle cx="110" cy="62" r="30" fill="#1d4a7a" />
              <path
                d="M92 50q14-8 22 6t-12 14-10-20zM118 76q8-4 14 4"
                fill="#4d7d5a"
                opacity=".8"
              />
              <g fill="none" stroke="#D5B77A" strokeWidth="1.5" className="sig">
                <path d="M150 84Q230 100 300 134" />
                <path d="M158 74Q250 86 322 128" opacity=".5" />
              </g>
              <path d="M0 150Q80 136 170 148T300 138 400 152V190H0z" fill="#1a2a44" />
              <path
                d="M0 150Q80 136 170 148T300 138 400 152"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <rect x="296" y="124" width="14" height="14" rx="2" fill="#D5B77A" />
            </svg>
            <p className="label">Earth visibility</p>
            <h3>Can the spacecraft directly communicate with Earth?</h3>
            <p>
              Direct communication depends on Earth&apos;s position relative to the lunar horizon.
              Visibility conditions can influence command, control, and scientific data
              transmission.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: "Select a landing site",
    body: "Choose a predefined lunar landing location.",
    icon: (
      <>
        <circle cx="16" cy="14" r="6" />
        <path d="M16 20v8M16 4v2" />
      </>
    ),
  },
  {
    title: "Choose a date & time",
    body: "Select the mission date and time to explore changing environmental conditions.",
    icon: (
      <>
        <rect x="5" y="7" width="22" height="19" rx="3" />
        <path d="M5 13h22M11 4v5M21 4v5" />
      </>
    ),
  },
  {
    title: "Analyze Sun & Earth positions",
    body: "Understand Sun and Earth positions relative to the selected location's local horizon.",
    icon: (
      <>
        <circle cx="10" cy="10" r="4" />
        <circle cx="23" cy="8" r="3" />
        <path d="M3 24h26" />
      </>
    ),
  },
  {
    title: "Compare mission conditions",
    body: "Explore operational considerations and compare different landing scenarios.",
    icon: <path d="M5 26V14M13 26V6M21 26V18M29 26V10" />,
  },
];

export function HowItWorks() {
  return (
    <section className="sec alt" id="how" data-section>
      <div className="wrap">
        <h2 className="rv">From lunar location to mission insight.</h2>
        <p className="sub rv">
          LunaNav simplifies complex lunar environmental information into a clear, understandable
          evaluation process.
        </p>
        <ol className="steps" id="steps">
          {STEPS.map((s, i) => (
            <li className="rv" key={s.title}>
              <span className="num">{i + 1}</span>
              <svg viewBox="0 0 32 32" aria-hidden="true">
                {s.icon}
              </svg>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    title: "Solar visibility",
    body: "Track the Sun relative to the lunar horizon and understand potential sunlight availability.",
    icon: (
      <>
        <circle cx="16" cy="16" r="5" />
        <path d="M16 3v4M16 25v4M3 16h4M25 16h4M7 7l3 3M22 22l3 3M25 7l-3 3M10 22l-3 3" />
      </>
    ),
  },
  {
    title: "Earth visibility",
    body: "Identify potential direct communication opportunities with Earth.",
    icon: (
      <>
        <circle cx="16" cy="16" r="11" />
        <path d="M5 16h22M16 5c-5 6-5 16 0 22M16 5c5 6 5 16 0 22" />
      </>
    ),
  },
  {
    title: "Landing site comparison",
    body: "Compare multiple lunar locations and their environmental conditions.",
    icon: (
      <>
        <circle cx="9" cy="16" r="6" />
        <circle cx="23" cy="16" r="6" />
      </>
    ),
  },
  {
    title: "Date flexibility",
    body: "Explore how different mission dates and times can affect landing conditions.",
    icon: (
      <>
        <rect x="5" y="7" width="22" height="19" rx="3" />
        <path d="M5 13h22M12 19h8" />
      </>
    ),
  },
  {
    title: "Mission timelines",
    body: "Understand potential sunlight and communication windows through time-based visualizations.",
    icon: <path d="M3 10h14M3 16h24M3 22h18" />,
  },
  {
    title: "Scientific data",
    body: "The project is designed around scientific resources such as NASA and JPL data.",
    icon: (
      <>
        <ellipse cx="16" cy="8" rx="10" ry="4" />
        <path d="M6 8v16c0 2 4.5 4 10 4s10-2 10-4V8M6 16c0 2 4.5 4 10 4s10-2 10-4" />
      </>
    ),
  },
];

export function Features() {
  return (
    <section className="sec" id="features" data-section>
      <div className="wrap">
        <h2 className="rv">Engineered for lunar exploration.</h2>
        <p className="sub rv">
          Explore the capabilities that make lunar landing-site evaluation easier to understand.
        </p>
        <div className="grid3">
          {FEATURES.map((f) => (
            <Tilt className="card" key={f.title}>
              <svg viewBox="0 0 32 32" aria-hidden="true">
                {f.icon}
              </svg>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </Tilt>
          ))}
        </div>
      </div>
    </section>
  );
}

const FACTS = [
  { title: "Long shadows", body: "Low Sun angles stretch shadows across the terrain." },
  { title: "Complex terrain", body: "Craters and ridges shape what a site can see." },
  {
    title: "Low-angle sunlight",
    body: "The Sun stays near the horizon, affecting potential solar power.",
  },
  {
    title: "Limited communication windows",
    body: "Earth may sit near or below the local horizon.",
  },
  {
    title: "Permanently shadowed regions",
    body: "Some areas may never receive direct sunlight.",
  },
  {
    title: "Scientific importance",
    body: "Potential water-ice resources make the region a scientific interest. Site suitability still requires dedicated mission analysis.",
  },
];

export function Why() {
  return (
    <section className="sec why" id="why" data-section>
      <div className="wrap">
        <h2 className="rv">The next frontier of lunar exploration.</h2>
        <p className="sub rv">
          The lunar South Pole is an important target for future exploration because of its unique
          environment and scientific potential. However, it presents several operational challenges.
        </p>
        <svg className="ridge" viewBox="0 0 1200 160" preserveAspectRatio="none" aria-hidden="true">
          <path
            className="r1"
            d="M0 120L150 70 260 105 420 40 560 95 720 55 880 110 1040 60 1200 100V160H0z"
          />
          <path
            className="r2"
            d="M0 140L200 105 340 130 560 90 760 128 980 96 1200 130V160H0z"
          />
        </svg>
        <ul className="facts">
          {FACTS.map((f) => (
            <li className="rv" key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </li>
          ))}
        </ul>
        <p className="sub rv">
          LunaNav helps users understand these considerations by showing the Sun and Earth relative
          to a site&apos;s local horizon.
        </p>
      </div>
    </section>
  );
}

const TECH = [
  { mark: "N", title: "NASA Data", body: "Scientific resources supporting lunar exploration." },
  {
    mark: "J",
    title: "JPL Horizons",
    body: "Designed to provide celestial ephemeris information and Sun/Earth position data.",
  },
  {
    mark: "T",
    title: "NASA Moon Trek",
    body: "A resource for lunar surface visualization and geographic exploration.",
  },
  {
    mark: "L",
    title: "LROC QuickMap & LOLA",
    body: "Lunar imagery and topographic resources that may support surface and terrain understanding.",
  },
];

export function Technology() {
  return (
    <section className="sec alt" id="technology" data-section>
      <div className="wrap">
        <h2 className="rv">Built around scientific data.</h2>
        <p className="sub rv">
          LunaNav is designed to translate scientific resources into accessible lunar mission
          insights. It is an independent project and is not endorsed by NASA.
        </p>
        <div className="grid4">
          {TECH.map((t) => (
            <Tilt className="card" key={t.title}>
              <span className="mark">{t.mark}</span>
              <h3>{t.title}</h3>
              <p>{t.body}</p>
            </Tilt>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Cta({ onExplore }: { onExplore: () => void }) {
  return (
    <section className="sec cta" id="launch" data-section>
      <div className="orbit" aria-hidden="true">
        <i />
      </div>
      <div className="wrap center">
        <h2 className="rv">Ready to explore the lunar South Pole?</h2>
        <p className="sub rv">
          Discover how sunlight availability and Earth visibility can shape the evaluation of
          future lunar landing scenarios.
        </p>
        <button className="btn btn-gold btn-lg glow" type="button" onClick={onExplore}>
          Launch LunaNav <i className="arr">→</i>
        </button>
      </div>
    </section>
  );
}
