import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { FormNav } from "@/components/FormNav";
import type { AgreementContent, AgreementStatement } from "@/lib/wagtail.functions";

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

/**
 * Whether one item is done: a statement is ticked, or a question is answered.
 * A question with a correct answer only counts once that answer is chosen;
 * one without accepts any answer.
 */
function isComplete(
  key: string,
  statement: AgreementStatement,
  accepted: Record<string, boolean>,
  answers: Record<string, string>,
) {
  if (statement.kind !== "question") return accepted[key] ?? false;
  const chosen = statement.choices.find((c) => c.id === answers[key]);
  if (!chosen) return false;
  return statement.choices.some((c) => c.correct) ? chosen.correct : true;
}

/** Every item exists and is done. An agreement with none never counts as done. */
function agreementComplete(
  agreement: AgreementContent,
  accepted: Record<string, boolean>,
  answers: Record<string, string>,
) {
  return (
    agreement.statements.length > 0 &&
    agreement.statements.every((s) =>
      isComplete(statementKey(agreement.slug, s.id), s, accepted, answers),
    )
  );
}

export function AgreementsScreen({
  agreements,
  accepted,
  setAccepted,
  answers,
  setAnswer,
  onBack,
  onFinish,
}: {
  agreements: AgreementContent[];
  accepted: Record<string, boolean>;
  setAccepted: (key: string, value: boolean) => void;
  /** Chosen answer id per question, keyed like `accepted`. */
  answers: Record<string, string>;
  setAnswer: (key: string, choiceId: string) => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  // Starts on the first agreement that is not complete, so an applicant who
  // left part-way through (their ticks and answers are saved) resumes where
  // they stopped instead of re-reading the ones already done. With nothing
  // done that is the first agreement; with everything done, the last.
  const [pageIdx, setPageIdx] = useState(() => {
    const firstOpen = agreements.findIndex((ag) => !agreementComplete(ag, accepted, answers));
    return firstOpen === -1 ? Math.max(agreements.length - 1, 0) : firstOpen;
  });
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const isFirst = pageIdx === 0;
  const isLast = pageIdx === agreements.length - 1;
  const agreement = agreements[pageIdx];
  // Every item must exist and be done. An agreement with zero items (a
  // content gap) is never treated as satisfied, rather than trivially passing
  // with nothing to check.
  const allChecked = agreementComplete(agreement, accepted, answers);
  const hasQuestions = agreement.statements.some((s) => s.kind === "question");
  const todo = hasQuestions
    ? "Tick every statement and answer every question to continue."
    : "Tick every statement to continue.";

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
    <>
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

            <div
              role="group"
              aria-label={agreement.submissionTitle}
              className="mt-3.5 grid gap-2.5"
            >
              {agreement.statements.length === 0 && (
                <p className="rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                  This agreement has no statements to accept yet. Add at least one in the Wagtail
                  admin (Content Management → Agreements) before an applicant can continue past this page.
                </p>
              )}
              {agreement.statements.map((statement) => {
                const key = statementKey(agreement.slug, statement.id);
                if (statement.kind === "question") {
                  return (
                    <ChoiceQuestion
                      key={statement.id}
                      name={key}
                      statement={statement}
                      chosenId={answers[key]}
                      onChoose={(choiceId) => setAnswer(key, choiceId)}
                    />
                  );
                }
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
            {!allChecked && agreement.statements.length > 0 && (
              <p className="mt-3 text-xs font-semibold text-secondary">{todo}</p>
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
      </div>

      <FormNav
        onBack={goPrev}
        backLabel={isFirst ? "Back to your check-in" : "Back"}
        onNext={goNext}
        canAdvance={allChecked}
        nextLabel={isLast ? "See River Run" : "Next"}
        nextIcon={isLast ? <ShieldCheck className="h-4 w-4" /> : undefined}
        status={allChecked ? undefined : todo}
        label={`Agreement ${pageIdx + 1} of ${agreements.length}`}
      />
    </>
  );
}

/**
 * A multiple-choice question inside an agreement. When the CMS marks one
 * answer as correct the applicant hears straight away whether they got it,
 * and can try again; otherwise any answer is simply recorded.
 */
function ChoiceQuestion({
  name,
  statement,
  chosenId,
  onChoose,
}: {
  name: string;
  statement: AgreementStatement;
  chosenId: string | undefined;
  onChoose: (choiceId: string) => void;
}) {
  const chosen = statement.choices.find((c) => c.id === chosenId);
  const checked = statement.choices.some((c) => c.correct);
  const feedbackId = `${name}-feedback`;
  return (
    <fieldset
      className="rounded-2xl bg-[oklch(0.99_0.01_85)] p-3.5"
      aria-describedby={chosen && checked ? feedbackId : undefined}
    >
      <legend className="float-left mb-2 w-full text-[13px] leading-[1.55] font-semibold text-ink">
        {statement.text}
      </legend>
      <div className="clear-both grid gap-1.5">
        {statement.choices.map((choice) => (
          <label
            key={choice.id}
            className="flex cursor-pointer items-start gap-2.5 rounded-xl p-2 transition-colors hover:bg-primary-soft"
          >
            <input
              type="radio"
              name={name}
              value={choice.id}
              checked={chosenId === choice.id}
              onChange={() => onChoose(choice.id)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
            />
            <span className="text-[13px] leading-[1.55] text-ink">{choice.text}</span>
          </label>
        ))}
      </div>
      {chosen && checked && (
        <p
          id={feedbackId}
          role="status"
          className={`mt-2 text-xs font-semibold ${chosen.correct ? "text-[#2D712A]" : "text-destructive"}`}
        >
          {chosen.correct
            ? "That's right."
            : "Not quite. Have another read of the agreement above and try again."}
        </p>
      )}
    </fieldset>
  );
}
