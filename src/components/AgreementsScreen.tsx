import { useState } from "react";
import { ArrowLeft, ChevronRight, ShieldCheck } from "lucide-react";
import type { AgreementContent } from "@/lib/wagtail.functions";

function Paragraphs({ text, className }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  return (
    <>
      {paragraphs.map((para, i) => (
        <p key={i} className={`${className ?? ""} ${i > 0 ? "mt-4" : ""}`}>
          {para}
        </p>
      ))}
    </>
  );
}

// Key each statement's acceptance by agreement + statement id, so
// accepting a statement on one agreement never collides with — or gets
// confused with — a statement on another.
function statementKey(agreementSlug: string, statementId: number) {
  return `${agreementSlug}:${statementId}`;
}

export function AgreementsScreen({
  agreements,
  accepted,
  setAccepted,
  onBack,
  onFinish,
}: {
  agreements: AgreementContent[];
  accepted: Record<string, boolean>;
  setAccepted: (key: string, value: boolean) => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [pageIdx, setPageIdx] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const isFirst = pageIdx === 0;
  const isLast = pageIdx === agreements.length - 1;
  const agreement = agreements[pageIdx];
  // Every statement must exist and be individually checked. An agreement
  // with zero statements (a content gap) is never treated as satisfied,
  // rather than trivially passing with nothing to check.
  const allChecked =
    agreement.statements.length > 0 &&
    agreement.statements.every((s) => accepted[statementKey(agreement.slug, s.id)]);

  const goPrev = () => {
    if (isFirst) {
      onBack();
      return;
    }
    setDirection("back");
    // Clamped: isFirst/isLast are snapshots from the last render, so several
    // clicks fired before React re-renders would otherwise push pageIdx out
    // of `agreements`' bounds and crash on the next render's array access.
    setPageIdx((i) => Math.max(i - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goNext = () => {
    if (!allChecked) return;
    if (isLast) {
      onFinish();
      return;
    }
    setDirection("forward");
    setPageIdx((i) => Math.min(i + 1, agreements.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="ceremony-card mx-auto max-w-xl overflow-x-clip p-7 sm:p-10">
      <div
        key={pageIdx}
        className={direction === "forward" ? "animate-step-forward" : "animate-step-back"}
      >
        <div className="font-mono text-[11px] tracking-[0.16em] text-secondary uppercase">
          {agreement.headerTitle}
        </div>
        <p className="mt-1.5 text-[13px] text-ink/75">{agreement.headerDescription}</p>

        <div className="mt-[22px]">
          <div className="font-mono text-[10px] tracking-[0.12em] text-secondary uppercase">
            {agreement.instructionalTitle}
          </div>
          <h2 className="mt-1 text-2xl leading-snug text-ink">{agreement.bodyTitle}</h2>
          <div
            tabIndex={0}
            role="region"
            aria-label={agreement.bodyTitle}
            className="mt-3 max-h-[220px] overflow-y-auto rounded-[18px] bg-[oklch(0.93_0.02_85)] p-[18px] text-[13px] leading-relaxed whitespace-pre-line text-ink/88"
          >
            <Paragraphs text={agreement.bodyDescription} />
          </div>
        </div>

        <div className="mt-6 rounded-[22px] bg-primary-soft p-[22px]">
          <div className="font-mono text-[10px] tracking-[0.12em] text-secondary uppercase">
            {agreement.submissionInstructionTitle}
          </div>
          <h3 className="mt-1 text-[19px] leading-snug text-ink">{agreement.submissionTitle}</h3>
          <Paragraphs
            text={agreement.submissionDescription}
            className="mt-1.5 text-[13px] text-ink/75"
          />

          <div role="group" aria-label={agreement.submissionTitle} className="mt-3.5 grid gap-2.5">
            {agreement.statements.length === 0 && (
              <p className="rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                This agreement has no statements to accept yet. Add at least one in the Wagtail
                admin (Snippets → Agreements) before an applicant can continue past this page.
              </p>
            )}
            {agreement.statements.map((statement) => {
              const key = statementKey(agreement.slug, statement.id);
              const checked = accepted[key] ?? false;
              return (
                <label
                  key={statement.id}
                  className="flex cursor-pointer items-start gap-2.5 rounded-2xl bg-[oklch(0.99_0.01_85)] p-3.5 transition-transform active:scale-[0.97]"
                >
                  <input
                    type="checkbox"
                    className="cer-check"
                    checked={checked}
                    onChange={(e) => setAccepted(key, e.target.checked)}
                  />
                  <span className="text-[13px] leading-[1.55] text-ink">{statement.text}</span>
                </label>
              );
            })}
          </div>
          {!allChecked && (
            <p role="status" className="mt-3 text-xs font-semibold text-secondary">
              Accept both statements to continue.
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex gap-1" aria-hidden="true">
        {agreements.map((a, i) => (
          <span
            key={a.slug}
            className="h-1.5 w-1.5 rounded-full transition-all duration-300"
            style={{
              background:
                i < pageIdx
                  ? "var(--color-primary)"
                  : i === pageIdx
                    ? "var(--color-gold)"
                    : "oklch(0.16 0.02 280 / 0.15)",
              transform: i === pageIdx ? "scale(1.4)" : "scale(1)",
            }}
          />
        ))}
      </div>

      <div className="animate-fade-in sticky bottom-4 mt-[18px] flex items-center justify-between gap-3 rounded-full border-[1.5px] border-ink/15 bg-cream p-2">
        <button
          onClick={goPrev}
          className="inline-flex items-center gap-1.5 rounded-full px-[18px] py-2.5 text-[13px] font-semibold text-secondary transition hover:bg-primary-soft"
        >
          <ArrowLeft className="h-4 w-4" />
          {isFirst ? "Back to your check-in" : "Previous"}
        </button>
        <button
          onClick={goNext}
          aria-disabled={!allChecked}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-[22px] py-3 text-[13px] font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-90"
          style={{ opacity: allChecked ? 1 : 0.4, cursor: allChecked ? "pointer" : "not-allowed" }}
        >
          {isLast ? (
            <>
              <ShieldCheck className="h-4 w-4" />
              See River Run
            </>
          ) : (
            <>
              Next
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
