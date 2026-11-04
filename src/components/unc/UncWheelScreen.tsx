import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useUncWheel } from "@/hooks/use-unc-wheel";
import { BrainWheel } from "./BrainWheel";
import { PersonCard } from "./PersonCard";
import { RevealedList } from "./RevealedList";
import { UncFaces, UncProgress } from "./UncProgress";

// Shared pill-button look (mono uppercase, 48px tall, gold focus ring that
// shows on the violet backdrop).
const BTN =
  "cer-cta h-auto min-h-12 w-full rounded-full px-6 py-3 font-mono text-[13px] leading-[18px] font-medium tracking-[0.08em] whitespace-normal uppercase focus-visible:ring-[3px] focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto";
const BTN_SECONDARY = `${BTN} border-2 border-cream bg-transparent text-cream hover:bg-cream/10`;

export function UncWheelScreen() {
  const reduced = useReducedMotion();
  const w = useUncWheel(reduced);
  const skipRef = useRef<HTMLButtonElement>(null);

  // The Spin button disables mid-spin; hand focus to Skip so keyboard users
  // are never dropped onto the page body.
  useEffect(() => {
    if (w.spinning) skipRef.current?.focus();
  }, [w.spinning]);

  const n = w.revealed.length;
  let headline: string;
  let subline: string;
  if (w.spinning) {
    headline = "Spinning…";
    subline = "Someone unlikely is on the way.";
  } else if (w.meet && w.current) {
    headline = w.current.name;
    subline = w.current.country;
  } else if (w.done) {
    headline = "All four are here";
    subline = "Your group of five is ready.";
  } else {
    headline = `Ready for number ${n + 1}?`;
    subline = reduced
      ? "Select Reveal next when you're ready."
      : n === 0
        ? "Tap the wheel or press Spin to begin."
        : "Spin again to meet your next connection.";
  }

  const wheelLabel = w.done
    ? "All connections revealed"
    : reduced
      ? "Reveal your next connection"
      : "Spin the wheel to reveal your next connection";

  return (
    <main className="mx-auto flex max-w-[1280px] flex-wrap gap-12 px-6 pt-6 pb-16 text-cream md:px-16">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {w.announcement}
      </p>

      <header className="flex w-full flex-wrap items-center gap-4">
        <span className="flex h-12 items-center rounded-lg bg-cream px-4">
          <img src="/design/unc/unc-logo.png" alt="UNC" className="block h-7 w-auto" />
        </span>
        <span className="hidden rounded-full bg-success px-4 py-1 font-display text-[24px] leading-8 tracking-[0.02em] text-ink uppercase sm:inline">
          Unlikely Connections
        </span>
      </header>

      <section
        aria-label="Discovery wheel"
        className="flex min-w-0 flex-[999_1_480px] flex-col items-center gap-6"
      >
        <UncFaces revealed={w.revealed} total={w.total} />
        <div className="flex min-h-[84px] flex-col gap-2 text-center">
          <h1 className="text-[32px] leading-9 text-cream sm:text-[48px] sm:leading-[52px]">
            {headline}
          </h1>
          <p className="m-0 text-cream/75">{subline}</p>
        </div>

        <BrainWheel
          rotation={w.rotation}
          animate={w.animate}
          landed={w.landed}
          disabled={w.spinning || w.done}
          label={wheelLabel}
          onSpin={w.spin}
        />

        {/* Outside the wheel and never rotated. */}
        <p className="m-0 max-w-[560px] text-center font-display text-[24px] leading-8 tracking-[0.02em] text-cream uppercase sm:text-[32px] sm:leading-9">
          Designing AIME&apos;s <span className="text-gold">Unlikely Connections</span> for a Fairer
          World
        </p>

        {!w.done && (
          <div className="flex w-full flex-wrap justify-center gap-3">
            {reduced ? (
              <Button className={BTN} onClick={w.revealNow}>
                Reveal next
              </Button>
            ) : (
              <>
                <Button className={BTN} onClick={w.spin} disabled={w.spinning}>
                  Spin the wheel
                </Button>
                {w.spinning ? (
                  <Button ref={skipRef} className={BTN_SECONDARY} onClick={w.skip}>
                    Skip animation
                  </Button>
                ) : (
                  <Button className={BTN_SECONDARY} onClick={w.revealNow}>
                    Reveal without spinning
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <aside
        aria-label="Your connections"
        className="flex min-w-0 flex-[1_1_340px] flex-col gap-8 pt-4"
      >
        <UncProgress revealed={n} total={w.total} />

        {w.showCard && w.current ? (
          <PersonCard
            key={w.current.id}
            person={w.current}
            number={w.revealed.findIndex((p) => p.id === w.current?.id) + 1}
            total={w.total}
            className={reduced ? "" : "animate-fade-in"}
          />
        ) : (
          <div className="flex min-h-32 items-center gap-4 rounded-[28px] border-2 border-dashed border-cream/60 p-6">
            <img
              src="/design/unc/qm-violet.png"
              alt=""
              aria-hidden="true"
              className="h-14 w-14 shrink-0"
            />
            <p className="m-0 text-[18px] leading-7 text-cream/75">
              {w.spinning || (w.landed && !w.showCard)
                ? "Finding someone unlikely…"
                : "Your next connection will appear here."}
            </p>
          </div>
        )}

        <RevealedList people={w.revealed} />
      </aside>
    </main>
  );
}
