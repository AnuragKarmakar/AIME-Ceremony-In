import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

type SceneItem = {
  src: string;
  top?: string;
  bottom?: string;
  side: string; // e.g. "left:6%" or "right:8%"
  width: string;
  opacity: number;
  anim: string; // CSS animation shorthand, or "none"
};

type SceneData = { t1: string; t2: string; items: SceneItem[] };

// Per-step tint + floating icon layout, ported verbatim from the
// Visual re-design mockup's STEP_SCENES table.
const STEP_SCENES: Record<string, SceneData> = {
  welcome: {
    t1: "oklch(0.42 0.17 300)",
    t2: "oklch(0.50 0.20 30 / 0.35)",
    items: [
      {
        src: "/design/icon-sun.png",
        top: "8%",
        side: "left:6%",
        width: "90px",
        opacity: 0.5,
        anim: "cerFloatSlow 9s ease-in-out infinite",
      },
      {
        src: "/design/icon-moon.png",
        top: "14%",
        side: "right:8%",
        width: "78px",
        opacity: 0.55,
        anim: "cerFloatSlow 11s ease-in-out infinite 1s",
      },
      {
        src: "/design/icon-balloon1.png",
        top: "46%",
        side: "left:10%",
        width: "52px",
        opacity: 0.45,
        anim: "cerDrift1 22s ease-in-out infinite",
      },
      {
        src: "/design/icon-tree.png",
        side: "right:5%",
        width: "200px",
        opacity: 0.16,
        anim: "none",
        bottom: "-4%",
      },
    ],
  },
  path: {
    t1: "oklch(0.40 0.16 250)",
    t2: "oklch(0.55 0.18 200 / 0.35)",
    items: [
      {
        src: "/design/icon-telescope.png",
        top: "10%",
        side: "right:10%",
        width: "84px",
        opacity: 0.55,
        anim: "cerFloatSlow 10s ease-in-out infinite",
      },
      {
        src: "/design/icon-balloon3.png",
        top: "38%",
        side: "left:7%",
        width: "50px",
        opacity: 0.45,
        anim: "cerDrift2 24s ease-in-out infinite",
      },
      {
        src: "/design/icon-balloon1.png",
        top: "62%",
        side: "right:12%",
        width: "40px",
        opacity: 0.35,
        anim: "cerDrift1 28s ease-in-out infinite 2s",
      },
      {
        src: "/design/icon-tree.png",
        side: "left:4%",
        width: "180px",
        opacity: 0.14,
        anim: "none",
        bottom: "-4%",
      },
    ],
  },
  identity: {
    t1: "oklch(0.42 0.20 330)",
    t2: "oklch(0.35 0.16 290 / 0.4)",
    items: [
      {
        src: "/design/icon-moon.png",
        top: "12%",
        side: "left:8%",
        width: "70px",
        opacity: 0.5,
        anim: "cerFloatSlow 12s ease-in-out infinite",
      },
      {
        src: "/design/icon-bank.png",
        top: "40%",
        side: "right:10%",
        width: "110px",
        opacity: 0.3,
        anim: "cerFloatSlow 13s ease-in-out infinite 1s",
      },
      {
        src: "/design/icon-cinema.png",
        top: "64%",
        side: "left:14%",
        width: "90px",
        opacity: 0.25,
        anim: "none",
      },
      {
        src: "/design/icon-tree.png",
        side: "right:4%",
        width: "190px",
        opacity: 0.14,
        anim: "none",
        bottom: "-4%",
      },
    ],
  },
  story: {
    t1: "oklch(0.50 0.19 40)",
    t2: "oklch(0.45 0.20 320 / 0.35)",
    items: [
      {
        src: "/design/icon-cinema.png",
        top: "9%",
        side: "left:9%",
        width: "110px",
        opacity: 0.35,
        anim: "cerFloatSlow 10s ease-in-out infinite",
      },
      {
        src: "/design/icon-sun.png",
        top: "16%",
        side: "right:9%",
        width: "80px",
        opacity: 0.4,
        anim: "cerFloatSlow 9s ease-in-out infinite 1s",
      },
      {
        src: "/design/icon-balloon3.png",
        top: "55%",
        side: "left:12%",
        width: "46px",
        opacity: 0.35,
        anim: "cerDrift2 25s ease-in-out infinite",
      },
      {
        src: "/design/icon-tree.png",
        side: "right:4%",
        width: "190px",
        opacity: 0.15,
        anim: "none",
        bottom: "-4%",
      },
    ],
  },
  result: {
    t1: "oklch(0.55 0.16 90 / 0.5)",
    t2: "oklch(0.42 0.17 300)",
    items: [
      {
        src: "/design/icon-sun.png",
        top: "9%",
        side: "left:8%",
        width: "110px",
        opacity: 0.6,
        anim: "cerFloatSlow 9s ease-in-out infinite",
      },
      {
        src: "/design/icon-moon.png",
        top: "13%",
        side: "right:8%",
        width: "84px",
        opacity: 0.5,
        anim: "cerFloatSlow 11s ease-in-out infinite 1s",
      },
      {
        src: "/design/icon-telescope.png",
        top: "58%",
        side: "right:14%",
        width: "76px",
        opacity: 0.3,
        anim: "none",
      },
      {
        src: "/design/icon-bridge.png",
        side: "left:30%",
        width: "320px",
        opacity: 0.15,
        anim: "none",
        bottom: "-3%",
      },
    ],
  },
  quiz: {
    t1: "oklch(0.55 0.13 195)",
    t2: "oklch(0.40 0.16 260 / 0.35)",
    items: [
      {
        src: "/design/icon-bank.png",
        top: "11%",
        side: "right:9%",
        width: "100px",
        opacity: 0.3,
        anim: "cerFloatSlow 12s ease-in-out infinite",
      },
      {
        src: "/design/icon-moon.png",
        top: "15%",
        side: "left:8%",
        width: "66px",
        opacity: 0.4,
        anim: "cerFloatSlow 13s ease-in-out infinite 1s",
      },
      {
        src: "/design/icon-bridge.png",
        side: "left:34%",
        width: "300px",
        opacity: 0.16,
        anim: "none",
        bottom: "-3%",
      },
      {
        src: "/design/icon-tree.png",
        side: "right:4%",
        width: "180px",
        opacity: 0.14,
        anim: "none",
        bottom: "-4%",
      },
    ],
  },
  agreements: {
    t1: "oklch(0.32 0.15 300)",
    t2: "oklch(0.40 0.16 250 / 0.4)",
    items: [
      {
        src: "/design/icon-bank.png",
        top: "10%",
        side: "left:9%",
        width: "100px",
        opacity: 0.3,
        anim: "cerFloatSlow 11s ease-in-out infinite",
      },
      {
        src: "/design/icon-telescope.png",
        top: "60%",
        side: "right:12%",
        width: "78px",
        opacity: 0.3,
        anim: "none",
      },
      {
        src: "/design/icon-balloon1.png",
        top: "20%",
        side: "right:8%",
        width: "44px",
        opacity: 0.35,
        anim: "cerDrift1 26s ease-in-out infinite 2s",
      },
      {
        src: "/design/icon-tree.png",
        side: "left:5%",
        width: "190px",
        opacity: 0.15,
        anim: "none",
        bottom: "-4%",
      },
    ],
  },
  journey: {
    t1: "oklch(0.58 0.16 90 / 0.45)",
    t2: "oklch(0.42 0.19 300)",
    items: [
      {
        src: "/design/icon-sun.png",
        top: "8%",
        side: "left:6%",
        width: "90px",
        opacity: 0.5,
        anim: "cerFloatSlow 9s ease-in-out infinite",
      },
      {
        src: "/design/icon-moon.png",
        top: "12%",
        side: "right:6%",
        width: "84px",
        opacity: 0.5,
        anim: "cerFloatSlow 11s ease-in-out infinite 1s",
      },
      {
        src: "/design/icon-balloon1.png",
        top: "42%",
        side: "left:11%",
        width: "50px",
        opacity: 0.4,
        anim: "cerDrift1 22s ease-in-out infinite",
      },
      {
        src: "/design/icon-balloon3.png",
        top: "56%",
        side: "right:14%",
        width: "46px",
        opacity: 0.4,
        anim: "cerDrift2 26s ease-in-out infinite 2s",
      },
      {
        src: "/design/icon-bridge.png",
        side: "left:32%",
        width: "320px",
        opacity: 0.16,
        anim: "none",
        bottom: "-3%",
      },
    ],
  },
};

// Deterministic star field — same formula every render, no random state.
const STARS = Array.from({ length: 40 }, (_, i) => ({
  top: `${((i * 37) % 90) + 3}%`,
  left: `${((i * 53) % 94) + 2}%`,
  size: `${2 + (i % 3)}px`,
  dur: `${3 + (i % 4)}s`,
  delay: `${(i * 0.4) % 3}s`,
}));

function SceneLayer({ scene, opacity }: { scene: SceneData; opacity: number }) {
  return (
    <div
      className="absolute inset-0 transition-opacity duration-[850ms] ease-out"
      style={{ opacity }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(1200px 800px at 20% 0%, ${scene.t1}, transparent 60%), radial-gradient(1000px 700px at 100% 30%, ${scene.t2}, transparent 55%)`,
        }}
      />
      {scene.items.map((item, i) => {
        const [side, sideVal] = item.side.split(":");
        const posStyle: React.CSSProperties = {
          width: item.width,
          opacity: Math.min(0.9, item.opacity + 0.16),
          animation: item.anim === "none" ? "none" : item.anim,
        };
        if (item.bottom) posStyle.bottom = item.bottom;
        else posStyle.top = item.top;
        if (side === "left") posStyle.left = sideVal;
        else posStyle.right = sideVal;
        return <img key={i} src={item.src} alt="" className="absolute" style={posStyle} />;
      })}
    </div>
  );
}

/**
 * Fixed, full-viewport ambient backdrop: base cosmic gradient, a twinkling
 * star field, and two crossfading tint/icon layers that swap whenever `step`
 * changes — mirrors the Visual re-design mockup's 2D/CSS fallback scene
 * (the WebGL version is intentionally not ported, see the implementation plan).
 */
export function AmbientBackground({ step }: { step: string }) {
  const reducedMotion = useReducedMotion();
  const [layerA, setLayerA] = useState(step);
  const [layerB, setLayerB] = useState<string | null>(null);
  const [active, setActive] = useState<"a" | "b">("a");
  const lastStep = useRef(step);

  useEffect(() => {
    if (step === lastStep.current) return;
    lastStep.current = step;
    if (active === "a") {
      setLayerB(step);
      setActive("b");
    } else {
      setLayerA(step);
      setActive("a");
    }
  }, [step, active]);

  const sceneA = STEP_SCENES[layerA] ?? STEP_SCENES.welcome;
  const sceneB = STEP_SCENES[layerB ?? ""] ?? STEP_SCENES.welcome;

  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
      style={{ background: "linear-gradient(180deg, #5F2AC1, #8D00FF, #000000)" }}
      aria-hidden="true"
    >
      {!reducedMotion &&
        STARS.map((star, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-[oklch(0.99_0.01_85)]"
            style={{
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              opacity: 0.7,
              animation: `cerTwinkle ${star.dur} ease-in-out infinite`,
              animationDelay: star.delay,
            }}
          />
        ))}

      <SceneLayer scene={sceneA} opacity={active === "a" ? 1 : 0} />
      {layerB && <SceneLayer scene={sceneB} opacity={active === "b" ? 1 : 0} />}

      {/* Scrim so header text stays legible over whatever the scene paints. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.14 0.05 300 / 0.78) 0px, oklch(0.14 0.05 300 / 0.45) 140px, oklch(0.14 0.05 300 / 0) 280px)",
        }}
      />
    </div>
  );
}
