import { useState } from "react";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
    setPageIdx((i) => i - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goNext = () => {
    if (isLast) {
      onFinish();
      return;
    }
    setDirection("forward");
    setPageIdx((i) => i + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="ceremony-card mx-auto max-w-2xl overflow-x-clip p-7 sm:p-10">
      <div
        key={pageIdx}
        className={direction === "forward" ? "animate-step-forward" : "animate-step-back"}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          {agreement.headerTitle}
        </div>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          {agreement.headerDescription}
        </p>

        <div className="mt-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">
            {agreement.instructionalTitle}
          </div>
          <h2 className="mt-1 font-display text-2xl leading-snug sm:text-3xl">
            {agreement.bodyTitle}
          </h2>
          <div className="mt-4 max-h-[40vh] overflow-y-auto rounded-2xl border border-border bg-muted/30 p-5 sm:p-6">
            <Paragraphs
              text={agreement.bodyDescription}
              className="text-sm leading-relaxed text-foreground sm:text-base"
            />
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-primary-soft/40 p-5 sm:p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">
            {agreement.submissionInstructionTitle}
          </div>
          <h3 className="mt-1 font-display text-xl leading-snug">{agreement.submissionTitle}</h3>
          <Paragraphs
            text={agreement.submissionDescription}
            className="mt-2 text-sm text-muted-foreground"
          />

          <div className="mt-5 space-y-3">
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
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary/40"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => setAccepted(key, v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm leading-relaxed text-foreground">{statement.text}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex flex-wrap items-center gap-1">
          {agreements.map((a, i) => (
            <span
              key={a.slug}
              className={[
                "h-1.5 w-1.5 rounded-full transition-all duration-300",
                i < pageIdx ? "bg-primary" : i === pageIdx ? "scale-125 bg-sunrise" : "bg-muted",
              ].join(" ")}
            />
          ))}
        </div>
      </div>

      <div className="animate-fade-in sticky bottom-4 mt-6 flex items-center justify-between gap-3 rounded-full border border-border bg-card/90 px-3 py-2 backdrop-blur">
        <button
          onClick={goPrev}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-secondary transition hover:bg-secondary-soft active:scale-[0.97]"
        >
          <ArrowLeft className="h-4 w-4" />
          {isFirst ? "Back to your check-in" : "Previous"}
        </button>
        <button
          onClick={goNext}
          disabled={!allChecked}
          className="inline-flex items-center gap-1.5 rounded-full bg-sunrise px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-warm transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
        >
          {isLast ? (
            <>
              <ShieldCheck className="h-4 w-4" />
              See River Run
            </>
          ) : (
            <>
              Next
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
