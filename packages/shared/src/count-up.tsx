"use client";
import { useEffect, useLayoutEffect, useRef } from "react";

// useLayoutEffect warns during SSR; fall back to useEffect on the server.
const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Number that counts up from 0 when scrolled into view.
 * The server renders the final value, so it is correct without JavaScript.
 */
export default function CountUp({
  to,
  duration = 1400,
  threshold = 0.4,
}: {
  to: number;
  duration?: number;
  threshold?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useIso(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.textContent = "0";
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = String(Math.round(to * eased));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration, threshold]);

  return <span ref={ref}>{to}</span>;
}
