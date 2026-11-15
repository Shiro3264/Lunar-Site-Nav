/**
 * The LunaNav brand mark and wordmark, lifted verbatim from the original
 * prototype's inline SVG so the logo is pixel-identical.
 */
type BrandMarkProps = {
  /** Unique id for the radial-gradient def (SVG ids must be document-unique). */
  id: string;
  size?: number;
};

export function BrandMark({ id, size = 36 }: BrandMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={id} cx=".34" cy=".3" r=".85">
          <stop offset="0" stopColor="#F4F6F8" />
          <stop offset=".55" stopColor="#B7C0CA" />
          <stop offset="1" stopColor="#5d6978" />
        </radialGradient>
      </defs>
      <g transform="rotate(-28 32 32)">
        <path d="M2 32A30 10 0 0 1 62 32" fill="none" stroke="#D5B77A" strokeWidth="1.8" opacity=".55" />
      </g>
      <circle cx="32" cy="32" r="20" fill={`url(#${id})`} />
      <g fill="#3a4656" opacity=".22">
        <circle cx="25" cy="26" r="4.6" />
        <circle cx="37" cy="37" r="6" />
        <circle cx="29" cy="40" r="2.6" />
        <circle cx="39" cy="24" r="2.2" />
      </g>
      <g transform="rotate(-28 32 32)">
        <path
          d="M2 32A30 10 0 0 0 62 32"
          fill="none"
          stroke="#D5B77A"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle className="ring" cx="51.3" cy="39.7" r="5" />
        <circle cx="51.3" cy="39.7" r="3.4" fill="#D5B77A" />
      </g>
    </svg>
  );
}

export function Logo({
  id,
  href = "#home",
  size = 36,
  className,
  label = "LunaNav home",
}: {
  id: string;
  href?: string;
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <a className={className ? `logo ${className}` : "logo"} href={href} aria-label={label}>
      <BrandMark id={id} size={size} />
      <span>LunaNav</span>
    </a>
  );
}
