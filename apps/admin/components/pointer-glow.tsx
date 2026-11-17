"use client";
import { useEffect } from "react";

/** Feeds the pointer position (as --mx/--my) to cards and buttons so CSS can draw a soft spotlight. */
export default function PointerGlow() {
  useEffect(() => {
    let raf = 0;
    const move = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        ".stats article, .panel, .recent, .sidebar nav button",
      );
      if (!el) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
