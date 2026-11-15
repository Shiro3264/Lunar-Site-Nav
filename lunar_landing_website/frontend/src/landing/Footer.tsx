import { Logo } from "@/landing/BrandMark";

export function Footer() {
  return (
    <footer className="foot">
      <Logo
        id="lnMarkFoot"
        className="foot-logo"
        href="#home"
        size={26}
        label="LunaNav, back to top"
      />
      <p>© LunaNav. Independent concept; not affiliated with or endorsed by NASA or JPL.</p>
    </footer>
  );
}
