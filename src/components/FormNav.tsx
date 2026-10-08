import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

/**
 * The one navigation bar for every step of the ceremony (the design's
 * "single usable component for all form navigation"): Back on the left,
 * a short status or context line in the middle, and the primary action on
 * the right. Used by the wizard steps, the quiz and the agreements.
 */
export function FormNav({
  onBack,
  backLabel = "Back",
  onNext,
  nextLabel = "Next",
  nextIcon,
  canAdvance = true,
  busy = false,
  status,
  label,
  done,
}: {
  onBack?: () => void;
  backLabel?: string;
  onNext?: () => void;
  nextLabel?: string;
  /** Replaces the default chevron after the label. */
  nextIcon?: ReactNode;
  canAdvance?: boolean;
  /** Shows a spinner and blocks the action, e.g. while a reflection is read. */
  busy?: boolean;
  /** Why the action is blocked. Announced to screen readers; takes the middle slot. */
  status?: string;
  /** Neutral context for the middle slot (e.g. the chosen path) when nothing is blocked. */
  label?: string;
  /** Shown instead of the action button at the end of the flow. */
  done?: string;
}) {
  const enabled = canAdvance && !busy;
  return (
    <nav
      aria-label="Ceremony steps"
      // Sits on the step background, as in the design: a text "← BACK" and a
      // solid "NEXT →" pill. It stays pinned to the bottom while a tall screen
      // scrolls, filled with --step-bg so content passes behind it cleanly;
      // that variable is animated (see styles.css), so the fill fades between
      // steps in sync with the page. mt-28 reserves blank space at least as
      // tall as the nav, so the last real field always scrolls clear of it.
      className="animate-fade-in sticky bottom-0 z-10 mt-28 flex items-center justify-between gap-3 bg-[var(--step-bg)] pt-3 pb-5"
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex shrink-0 items-center gap-2 rounded-full py-2 pr-3 font-mono text-[13px] font-bold tracking-[0.1em] text-[var(--step-fg)] uppercase transition hover:-translate-x-0.5 focus-visible:ring-2 focus-visible:ring-[var(--step-fg)] focus-visible:outline-none"
        >
          <span aria-hidden="true">←</span>
          {backLabel}
        </button>
      ) : (
        <span />
      )}

      {status ? (
        <span
          id="next-blocked-reason"
          role="status"
          className="min-w-0 flex-1 truncate text-center text-xs font-semibold text-[var(--step-fg-soft)]"
        >
          {status}
        </span>
      ) : label ? (
        <span className="hidden min-w-0 flex-1 truncate text-center font-mono text-[11px] tracking-[0.08em] text-[var(--step-fg-soft)] uppercase sm:block">
          {label}
        </span>
      ) : null}

      {done ? (
        <span className="shrink-0 font-mono text-[13px] font-bold tracking-[0.1em] text-[var(--step-fg)] uppercase">
          {done}
        </span>
      ) : onNext ? (
        <button
          type="button"
          onClick={() => enabled && onNext()}
          aria-disabled={!enabled}
          aria-describedby={status ? "next-blocked-reason" : undefined}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--step-cta-bg)] px-7 py-3 font-mono text-[13px] font-bold tracking-[0.1em] text-[var(--step-cta-fg)] uppercase transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[var(--step-fg)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--step-bg)] focus-visible:outline-none active:scale-90"
          style={{ opacity: enabled ? 1 : 0.45, cursor: enabled ? "pointer" : "not-allowed" }}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {nextLabel}
          {!busy && (nextIcon ?? <span aria-hidden="true">→</span>)}
        </button>
      ) : null}
    </nav>
  );
}
