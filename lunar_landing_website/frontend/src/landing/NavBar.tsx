/**
 * Landing navigation bar — a faithful React port of the prototype's header.
 * `Explore the Navigator` now performs real router navigation instead of opening
 * the placeholder "coming soon" dialog.
 */
import { useState } from "react";

import { Logo } from "@/landing/BrandMark";

export interface NavLinkDef {
  href: string; // in-page anchor, e.g. "#features"
  label: string;
}

export const NAV_LINKS: NavLinkDef[] = [
  { href: "#home", label: "Home" },
  { href: "#challenge", label: "The Challenge" },
  { href: "#how", label: "How It Works" },
  { href: "#features", label: "Features" },
  { href: "#technology", label: "Technology" },
  { href: "#why", label: "About" },
];

interface NavBarProps {
  solid: boolean;
  activeId: string;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onExplore: () => void;
}

export function NavBar({ solid, activeId, theme, onToggleTheme, onExplore }: NavBarProps) {
  const [open, setOpen] = useState(false);
  const light = theme === "light";

  return (
    <header className={solid ? "nav solid" : "nav"} id="nav">
      <Logo id="lnMarkNav" href="#home" size={36} />

      <div className="nav-right">
        <nav id="menu" className={open ? "menu open" : "menu"} aria-label="Primary">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={activeId === l.href.slice(1) ? "active" : undefined}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <button
            className="btn btn-gold btn-sm"
            type="button"
            onClick={() => {
              setOpen(false);
              onExplore();
            }}
          >
            Explore the Navigator
          </button>
        </nav>

        <button
          className="theme-btn"
          id="themeBtn"
          type="button"
          aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
          aria-pressed={light}
          title="Toggle theme"
          onClick={onToggleTheme}
        >
          <svg className="i-moon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
          <svg className="i-sun" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
          </svg>
        </button>

        <button
          className="burger"
          id="burger"
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
