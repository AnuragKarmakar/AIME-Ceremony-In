import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { QUIZ_SECTIONS } from "@/lib/quiz.data";

export function QuizScreen({
  answers,
  setAnswer,
  onBack,
  onFinish,
  finishing,
  error,
}: {
  answers: Record<string, number>;
  setAnswer: (id: string, value: number) => void;
  onBack: () => void;
  onFinish: () => void;
  finishing: boolean;
  error: string | null;
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
    setSectionIdx((i) => i - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goNext = () => {
    if (isLast) {
      onFinish();
      return;
    }
    setDirection("forward");
    setSectionIdx((i) => i + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="ceremony-card mx-auto max-w-2xl overflow-x-clip p-7 sm:p-10">
      <div
        key={sectionIdx}
        className={direction === "forward" ? "animate-step-forward" : "animate-step-back"}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          {section.subtitle ?? "A relational check-in"}
        </div>
        <h2 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">
          {section.title}
        </h2>
        {section.intro && (
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">{section.intro}</p>
        )}

        <div className="mt-8 space-y-8">
          {section.questions.map((q, i) => {
            const value = answers[q.id] ?? Math.floor((section.scale.length - 1) / 2);
            return (
              <div
                key={q.id}
                className="animate-fade-in"
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm leading-relaxed text-foreground sm:text-base">{q.prompt}</p>
                  <span
                    key={value}
                    className="animate-pop shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary"
                  >
                    {section.scale[value]}
                  </span>
                </div>
                <Slider
                  className="mt-4"
                  min={0}
                  max={section.scale.length - 1}
                  step={1}
                  value={[value]}
                  onValueChange={([v]) => setAnswer(q.id, v)}
                />
                <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
                  <span>{section.scale[0]}</span>
                  <span>{section.scale[section.scale.length - 1]}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && !finishing && (
        <div className="animate-fade-in mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-8">
        <div className="flex flex-wrap items-center gap-1">
          {QUIZ_SECTIONS.map((s, i) => (
            <span
              key={s.key}
              className={[
                "h-1.5 w-1.5 rounded-full transition-all duration-300",
                i < sectionIdx
                  ? "bg-primary"
                  : i === sectionIdx
                  ? "scale-125 bg-sunrise"
                  : "bg-muted",
              ].join(" ")}
            />
          ))}
        </div>
        <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Section {sectionIdx + 1} of {QUIZ_SECTIONS.length}
        </div>
      </div>

      <div className="animate-fade-in sticky bottom-4 mt-6 flex items-center justify-between gap-3 rounded-full border border-border bg-card/90 px-3 py-2 backdrop-blur">
        <button
          onClick={goPrev}
          disabled={finishing}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-secondary transition hover:bg-secondary-soft active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {isFirst ? "Back to your story" : "Previous"}
        </button>
        <button
          onClick={goNext}
          disabled={finishing}
          className="inline-flex items-center gap-1.5 rounded-full bg-sunrise px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-warm transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
        >
          {finishing && <Loader2 className="h-4 w-4 animate-spin" />}
          {finishing ? "Reading your words..." : isLast ? "Complete Ceremony" : "Next"}
          {!finishing && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
