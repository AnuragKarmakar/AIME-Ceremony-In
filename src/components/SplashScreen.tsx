import { useEffect, useState } from "react";

/**
 * Brief full-screen splash shown once on mount — logo, movement label, and a
 * filling progress bar — then fades out. Mirrors the Visual re-design
 * mockup's 500ms/780ms timing.
 */
export function SplashScreen() {
  const [hiding, setHiding] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t1 = setTimeout(() => setHiding(true), 500);
    const t2 = setTimeout(() => setVisible(false), 780);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-[22px] bg-[oklch(0.24_0.11_300)] transition-opacity duration-[280ms] ease-out"
      style={{ opacity: hiding ? 0 : 1 }}
    >
      <img
        src="/design/logo-final.png"
        alt=""
        className="h-[88px] w-[88px] object-contain"
        style={{ animation: "cerFloatSlow 1.4s ease-in-out infinite" }}
      />
      <div className="font-mono text-[11px] tracking-[0.22em] uppercase text-gold">
        AIME Imagi-Nation
      </div>
      <div className="h-1 w-[180px] overflow-hidden rounded-full bg-[oklch(0.95_0.02_85_/_0.15)]">
        <div
          className="h-full origin-left rounded-full bg-primary"
          style={{ animation: "cerSplashFill 0.5s ease-out forwards" }}
        />
      </div>
    </div>
  );
}
