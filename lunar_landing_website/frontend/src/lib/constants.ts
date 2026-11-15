/** Static app metadata: navigation, brand tokens and time-window presets. */

export interface NavItem {
  to: string;
  label: string;
  short: string;
  group: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Mission Overview Dashboard", short: "Overview", group: "Mission Control" },
  { to: "/navigator", label: "3D Lunar Navigator", short: "3D Navigator", group: "Mission Control" },
  { to: "/sites", label: "Landing Site Explorer", short: "Site Explorer", group: "Site Analysis" },
  { to: "/coordinates", label: "Coordinate Search", short: "Coordinates", group: "Site Analysis" },
  { to: "/rotation", label: "Moon Rotation Simulator", short: "Rotation", group: "Dynamics" },
  { to: "/observer", label: "Observer Perspective", short: "Observer", group: "Dynamics" },
  { to: "/sunlight", label: "Sunlight & Shadow Analysis", short: "Sunlight", group: "Environment" },
  { to: "/earth-comms", label: "Earth Communication", short: "Earth Comms", group: "Environment" },
  { to: "/solar", label: "Solar Energy Estimator", short: "Solar", group: "Environment" },
  { to: "/compare", label: "Landing Site Comparison", short: "Compare", group: "Assessment" },
  { to: "/ranking", label: "Suitability Ranking", short: "Ranking", group: "Assessment" },
  { to: "/timeline", label: "Mission Timeline", short: "Timeline", group: "Mission Control" },
  { to: "/validation", label: "Scientific Data & Validation", short: "Validation", group: "Data" },
  { to: "/reports", label: "Mission Reports", short: "Reports", group: "Data" },
  { to: "/settings", label: "Settings", short: "Settings", group: "Data" },
];

export const NAV_GROUPS = [
  "Mission Control",
  "Site Analysis",
  "Dynamics",
  "Environment",
  "Assessment",
  "Data",
];

export const BRAND = {
  navy: "#07111F",
  mid: "#0B1930",
  panel: "#0E1E38",
  silver: "#C9D0D8",
  gold: "#D5B77A",
  white: "#F4F6F8",
  muted: "#98A5B5",
  line: "#1B2C49",
};

export const CHART_COLORS = {
  sun: "#D5B77A",
  earth: "#6FA8DC",
  illumination: "#FBBF24",
  shadow: "#334155",
  grid: "#1B2C49",
  axis: "#98A5B5",
  gold: "#D5B77A",
  silver: "#C9D0D8",
};

/** Time-simulator presets required by the specification. */
export const TIME_PRESETS = [
  { label: "Now", hours: 0 },
  { label: "+1 h", hours: 1 },
  { label: "+6 h", hours: 6 },
  { label: "+12 h", hours: 12 },
  { label: "+24 h", hours: 24 },
  { label: "+7 d", hours: 24 * 7 },
  { label: "+30 d", hours: 24 * 30 },
];

export const DISCLAIMER =
  "LunaNav values are traceable to a cited source or explicitly labelled as estimates. " +
  "Suitability scores are transparent decision-support heuristics — never landing-success probabilities.";
