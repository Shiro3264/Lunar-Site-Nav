/**
 * Landing-page hooks.
 *
 * These re-implement the vanilla behaviours of the original prototype
 * (`initNav`, `initReveal`, `initTheme`, `initClock`, `initHeroHeight`) as React
 * hooks, preserving the exact DOM contracts (`.rv`/`.in`, `solid`, `.active`,
 * `--hero-h`, `data-theme`) so the ported CSS keeps working unchanged.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export type Theme = "dark" | "light";

const THEME_KEY = "lunanav-theme";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* storage unavailable — fall through to the brand default */
  }
  return "dark"; // the default brand look (matches the original prototype)
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);
  const [animating, setAnimating] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const toggle = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
    setAnimating(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAnimating(false), 400);
  }, []);

  return { theme, toggle, animating };
}

/** Live UTC `HH:MM:SS`, ticking once per second. */
export function useUtcClock(): string {
  const [text, setText] = useState(() => new Date().toISOString().slice(11, 19));
  useEffect(() => {
    const tick = () => setText(new Date().toISOString().slice(11, 19));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return text;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Reactive `prefers-reduced-motion` flag, kept in sync with the OS setting. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Adds `.in` to every `.rv` inside `root`, staggered like the original. */
export function useRevealObserver(rootRef: RefObject<HTMLElement>, deps: unknown[] = []) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".rv"));
    els.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 6) * 80}ms`;
    });
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Track which `[data-section]` is in view (drives the active nav link). */
export function useActiveSection(rootRef: RefObject<HTMLElement>, deps: unknown[] = []) {
  const [active, setActive] = useState("home");
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // The prototype remapped two section ids onto different nav anchors.
    const remap: Record<string, string> = { dashboard: "features", launch: "technology" };
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          setActive(remap[el.id] ?? el.id);
        }),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    root.querySelectorAll<HTMLElement>("[data-section]").forEach((s) => io.observe(s));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return active;
}

/** `.nav` gains `.solid` once the page is scrolled past `threshold` px. */
export function useSolidNav(threshold = 40): boolean {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > threshold);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return solid;
}

/**
 * Keeps the scoped `--hero-h` custom property in sync with the hero's height,
 * so the photo background (`::before`) starts right below the hero.
 */
export function useHeroHeightVar(rootRef: RefObject<HTMLElement>, heroRef: RefObject<HTMLElement>) {
  useEffect(() => {
    const root = rootRef.current;
    const hero = heroRef.current;
    if (!root || !hero) return;
    const set = () => root.style.setProperty("--hero-h", `${hero.offsetHeight}px`);
    set();
    window.addEventListener("resize", set);
    window.addEventListener("load", set);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(set) : null;
    ro?.observe(hero);
    return () => {
      window.removeEventListener("resize", set);
      window.removeEventListener("load", set);
      ro?.disconnect();
    };
  }, [rootRef, heroRef]);
}

/** Smooth in-page scrolling for the landing anchors (respects reduced motion). */
export function useAnchorScroll(rootRef: RefObject<HTMLElement>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const id = anchor.getAttribute("href")!.slice(1);
      if (!id) return;
      const section = root.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      if (!section) return;
      e.preventDefault();
      section.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
      history.replaceState(null, "", `#${id}`);
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [rootRef]);
}
