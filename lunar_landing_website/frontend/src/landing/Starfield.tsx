/**
 * Depth-layered drifting starfield, ported from the prototype's `initStars()`.
 * Honours `prefers-reduced-motion` (renders a single static frame).
 */
import { useEffect, useRef } from "react";

import { prefersReducedMotion } from "@/landing/hooks";

interface Star {
  x: number;
  y: number;
  z: number;
  a: number;
}

export function Starfield() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = prefersReducedMotion();
    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    let raf = 0;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const count = Math.min(220, (w * h) / 9000);
      stars = Array.from({ length: Math.max(1, Math.floor(count)) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 3 + 0.4,
        a: Math.random() * 0.6 + 0.3,
      }));
      if (reduce) draw();
    };

    function draw() {
      ctx!.clearRect(0, 0, w, h);
      for (const s of stars) {
        if (!reduce) {
          s.x -= s.z * 0.04;
          if (s.x < 0) s.x = w;
        }
        ctx!.fillStyle = `rgba(244,246,248,${s.a})`;
        ctx!.fillRect(s.x, s.y, s.z * 0.6, s.z * 0.6);
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize);
    resize();
    if (!reduce) draw();

    return () => {
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={ref} id="stars" aria-hidden="true" />;
}
