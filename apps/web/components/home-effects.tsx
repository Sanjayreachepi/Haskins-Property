"use client";
import { useEffect } from "react";

/** Home-page-only behaviour: scroll reveals, scroll progress bar, sticky-header state. */
export default function HomeEffects() {
  useEffect(() => {
    const root = document.documentElement;

    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    document
      .querySelectorAll<HTMLElement>("[data-reveal]")
      .forEach((el) => io.observe(el));

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        const max = root.scrollHeight - window.innerHeight;
        root.style.setProperty("--scroll", max > 0 ? String(y / max) : "0");
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      root.style.removeProperty("--scroll");
    };
  }, []);
  return <div className="scroll-progress" aria-hidden="true" />;
}
