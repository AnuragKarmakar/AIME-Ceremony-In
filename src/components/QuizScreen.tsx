import { memo, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { QUIZ_SECTIONS, type QuizScale } from "@/lib/quiz.data";

export function QuizScreen({
  answers,
  setAnswer,
  onBack,
  onFinish,
}: {
  answers: Record<string, number>;
  setAnswer: (id: string, value: number) => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [sectionIdx, setSectionIdx] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const isFirst = sectionIdx === 0;
  const isLast = sectionIdx === QUIZ_SECTIONS.length - 1;
  const section = QUIZ_SECTIONS[sectionIdx];

  const goPrev = () => {
    if (isFirst) {
      onBack();
      return;
    }
    setDirection("back");
    // Clamped: isFirst/isLast are snapshots from the last render, so several
    // clicks fired before React re-renders (e.g. a fast double-click) would
    // otherwise push sectionIdx out of QUIZ_SECTIONS' bounds and crash on
    // the next render's QUIZ_SECTIONS[sectionIdx] access.
    setSectionIdx((i) => Math.max(i - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goNext = () => {
    if (isLast) {
      onFinish();
      return;
    }
    setDirection("forward");
    setSectionIdx((i) => Math.min(i + 1, QUIZ_SECTIONS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="ceremony-card mx-auto max-w-xl overflow-x-clip p-7 sm:p-10">
      <div
        key={sectionIdx}
        className={direction === "forward" ? "animate-step-forward" : "animate-step-back"}
      >
        <div className="font-mono text-[11px] tracking-[0.16em] text-secondary uppercase">
          {section.subtitle ?? "A relational check-in"}
        </div>
        <h2 className="mt-2 text-[28px] leading-tight text-ink">{section.title}</h2>
        {section.intro && (
          <p className="mt-2 text-[13px] leading-relaxed text-ink/75">{section.intro}</p>
        )}

        <div className="mt-6 grid gap-[26px]">
          {section.questions.map((q) => (
            <QuizQuestionRow
              key={q.id}
              id={q.id}
              prompt={q.prompt}
              scale={section.scale}
              value={answers[q.id] ?? 0}
              onChange={setAnswer}
            />
          ))}
        </div>
      </div>

      <QuizProgressDots total={QUIZ_SECTIONS.length} current={sectionIdx} />

      <div className="animate-fade-in sticky bottom-4 mt-[22px] flex items-center justify-between gap-3 rounded-full border-[1.5px] border-ink/15 bg-cream p-2">
        <button
          onClick={goPrev}
          className="inline-flex items-center gap-1.5 rounded-full px-[18px] py-2.5 text-[13px] font-semibold text-secondary transition hover:bg-primary-soft"
        >
          <ArrowLeft className="h-4 w-4" />
          {isFirst ? "Back to your Ceremony" : "Previous"}
        </button>
        <button
          onClick={goNext}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-[22px] py-3 text-[13px] font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-90"
        >
          {isLast ? "Continue" : "Next"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Memoized so dragging one slider only re-renders that row: `scale` is a
// stable module-level array reference and `onChange` is the stable
// `setQuizAnswer` callback from the parent, so props are shallow-equal
// (and this bails out of re-rendering) for every sibling question.
const QuizQuestionRow = memo(function QuizQuestionRow({
  id,
  prompt,
  scale,
  value,
  onChange,
}: {
  id: string;
  prompt: string;
  scale: QuizScale;
  value: number;
  onChange: (id: string, value: number) => void;
}) {
  const max = scale.length - 1;
  const isBinary = scale.length === 2;
  const pct = max ? (value / max) * 100 : 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-3.5">
        <p className="m-0 text-sm leading-[1.55] text-ink">{prompt}</p>
        <span className="shrink-0 rounded-full bg-primary-soft px-3 py-1.5 text-[11px] font-bold text-secondary">
          {scale[value]}
        </span>
      </div>

      {isBinary ? (
        <div className="mt-3.5 flex gap-2.5">
          <button
            onClick={() => onChange(id, 0)}
            aria-pressed={value === 0}
            className="flex-1 rounded-[14px] border-2 p-3.5 text-sm font-bold text-ink transition-transform active:scale-[0.93]"
            style={{
              borderColor: value === 0 ? "var(--color-primary)" : "oklch(0.85 0.02 85)",
              background: value === 0 ? "var(--color-primary-soft)" : "oklch(0.99 0.01 85)",
            }}
          >
            No
          </button>
          <button
            onClick={() => onChange(id, 1)}
            aria-pressed={value === 1}
            className="flex-1 rounded-[14px] border-2 p-3.5 text-sm font-bold text-ink transition-transform active:scale-[0.93]"
            style={{
              borderColor: value === 1 ? "var(--color-primary)" : "oklch(0.85 0.02 85)",
              background: value === 1 ? "var(--color-primary-soft)" : "oklch(0.99 0.01 85)",
            }}
          >
            Yes
          </button>
        </div>
      ) : (
        <div className="cer-scale">
          <input
            type="range"
            min={0}
            max={max}
            step={1}
            value={value}
            onChange={(e) => onChange(id, Number(e.target.value))}
            aria-label={prompt}
            aria-valuetext={scale[value]}
            className="cer-range w-full"
            style={{
              background: `linear-gradient(to right, var(--color-primary) ${pct}%, oklch(0.88 0.02 85) ${pct}%)`,
            }}
          />
          <div aria-hidden="true" className="cer-scale-ticks">
            {scale.map((_, i) => (
              <span
                key={i}
                style={{
                  left: `${max ? (i / max) * 100 : 0}%`,
                  background: i <= value ? "var(--color-primary)" : "oklch(0.16 0.02 280 / 0.3)",
                }}
              />
            ))}
          </div>
          <div aria-hidden="true" className="cer-scale-labels">
            {scale.map((label, i) => (
              <span
                key={i}
                style={{
                  color: i === value ? "var(--color-primary)" : "oklch(0.16 0.02 280 / 0.55)",
                  fontWeight: i === value ? 700 : 500,
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// Memoized so slider drags (which change `answers`, not `sectionIdx`) don't
// re-render all 39 dots on every tick.
const QuizProgressDots = memo(function QuizProgressDots({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  return (
    <div className="mt-7">
      <div className="flex flex-wrap items-center gap-1">
        {QUIZ_SECTIONS.map((s, i) => (
          <span
            key={s.key}
            className="h-1.5 w-1.5 rounded-full transition-all duration-300"
            style={{
              background:
                i < current
                  ? "var(--color-primary)"
                  : i === current
                    ? "var(--color-gold)"
                    : "oklch(0.16 0.02 280 / 0.15)",
              transform: i === current ? "scale(1.4)" : "scale(1)",
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 font-mono text-[10px] tracking-[0.1em] text-ink/68 uppercase">
        Section {current + 1} of {total}
      </div>
    </div>
  );
});
