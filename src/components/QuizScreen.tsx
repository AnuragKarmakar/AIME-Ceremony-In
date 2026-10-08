import { memo, useState } from "react";
import { FormNav } from "@/components/FormNav";
import type { QuizScale } from "@/lib/quiz.data";
import { QUIZ_PAGES, QUIZ_THEMES, THEME_LAST_PAGE, XP_PER_QUIZ_PAGE } from "@/lib/quiz.pages";

const TOTAL_QUESTIONS = QUIZ_PAGES.reduce((n, p) => n + p.questionCount, 0);

/** Badge shown on each theme's reward screen, in theme order. */
const THEME_BADGES = [
  "/design/badge-star.png",
  "/design/badge-tick.png",
  "/design/badge-smiley.png",
  "/design/badge-hoodie.png",
  "/design/badge-star.png",
];

/** The "want the rest by email?" card appears after this many themes. */
const EMAIL_OFFER_AFTER_THEMES = 2;

export function QuizScreen({
  answers,
  setAnswer,
  pageIdx,
  setPageIdx,
  totalXp,
  onBack,
  onFinish,
  onPageComplete,
}: {
  answers: Record<string, number>;
  setAnswer: (id: string, value: number) => void;
  /** Owned by the parent so it survives a refresh with the rest of the saved progress. */
  pageIdx: number;
  setPageIdx: (updater: (i: number) => number) => void;
  totalXp: number;
  onBack: () => void;
  onFinish: () => void;
  /** Called once per newly completed page, to award XP. */
  onPageComplete: (pageIdx: number) => void;
}) {
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  // Theme whose reward screen is showing, between its last page and the next theme.
  const [rewardTheme, setRewardTheme] = useState<number | null>(null);

  const safeIdx = Math.min(Math.max(pageIdx, 0), QUIZ_PAGES.length - 1);
  const page = QUIZ_PAGES[safeIdx];
  const isFirst = safeIdx === 0;
  const isLast = safeIdx === QUIZ_PAGES.length - 1;

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const goPrev = () => {
    if (rewardTheme !== null) {
      setRewardTheme(null);
      setDirection("back");
      scrollTop();
      return;
    }
    if (isFirst) {
      onBack();
      return;
    }
    setDirection("back");
    // Clamped: several clicks before a re-render must not push the index out of range.
    setPageIdx((i) => Math.max(i - 1, 0));
    scrollTop();
  };

  const advancePage = () => {
    setRewardTheme(null);
    setDirection("forward");
    setPageIdx((i) => Math.min(i + 1, QUIZ_PAGES.length - 1));
    scrollTop();
  };

  const goNext = () => {
    if (rewardTheme !== null) {
      advancePage();
      return;
    }
    onPageComplete(safeIdx);
    if (isLast) {
      onFinish();
      return;
    }
    if (THEME_LAST_PAGE[page.themeIdx] === safeIdx) {
      setDirection("forward");
      setRewardTheme(page.themeIdx);
      scrollTop();
      return;
    }
    advancePage();
  };

  if (rewardTheme !== null) {
    return (
      <>
        <ThemeReward
          themeIdx={rewardTheme}
          totalXp={totalXp}
          answered={QUIZ_PAGES.slice(0, safeIdx + 1).reduce((n, p) => n + p.questionCount, 0)}
          onContinue={advancePage}
        />
        <FormNav
          onBack={goPrev}
          backLabel="Back"
          onNext={goNext}
          nextLabel="Keep going"
          label={`Next: ${QUIZ_THEMES[rewardTheme + 1]?.title ?? ""}`}
        />
      </>
    );
  }

  const theme = QUIZ_THEMES[page.themeIdx];

  return (
    <>
      <div className="ceremony-card mx-auto max-w-xl overflow-x-clip p-7 sm:p-10">
        <div
          key={safeIdx}
          className={direction === "forward" ? "animate-step-forward" : "animate-step-back"}
        >
          <div className="font-mono text-[11px] tracking-[0.16em] text-secondary uppercase">
            Theme {page.themeIdx + 1} of {QUIZ_THEMES.length} — {theme.title}
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink/70">{theme.blurb}</p>

          <div className="mt-6 grid gap-8">
            {page.blocks.map((block) => (
              <section key={`${block.section.key}-${block.part?.index ?? 0}`}>
                <h2 className="text-[24px] leading-tight text-ink">
                  {block.section.title}
                  {block.part && (
                    <span className="ml-2 align-middle font-mono text-[11px] tracking-[0.1em] text-ink/55 normal-case">
                      {block.part.index} of {block.part.of}
                    </span>
                  )}
                </h2>
                {block.section.subtitle && (
                  <div className="mt-1 font-mono text-[10px] tracking-[0.12em] text-secondary uppercase">
                    {block.section.subtitle}
                  </div>
                )}
                {block.section.intro && (!block.part || block.part.index === 1) && (
                  <p className="mt-2 text-[13px] leading-relaxed text-ink/75">
                    {block.section.intro}
                  </p>
                )}
                <div className="mt-4 grid gap-[26px]">
                  {block.questions.map((q) => (
                    <QuizQuestionRow
                      key={q.id}
                      id={q.id}
                      prompt={q.prompt}
                      scale={block.section.scale}
                      value={answers[q.id] ?? 0}
                      onChange={setAnswer}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <QuizProgressDots current={safeIdx} />
      </div>

      <FormNav
        onBack={goPrev}
        backLabel={isFirst ? "Back to your Ceremony" : "Back"}
        onNext={goNext}
        nextLabel={isLast ? "Continue" : "Next"}
        label={`Page ${safeIdx + 1} of ${QUIZ_PAGES.length} · +${XP_PER_QUIZ_PAGE} XP`}
      />
    </>
  );
}

function ThemeReward({
  themeIdx,
  totalXp,
  answered,
  onContinue,
}: {
  themeIdx: number;
  totalXp: number;
  answered: number;
  onContinue: () => void;
}) {
  const theme = QUIZ_THEMES[themeIdx];
  const next = QUIZ_THEMES[themeIdx + 1];
  const themePages = QUIZ_PAGES.filter((p) => p.themeIdx === themeIdx).length;
  const [emailAsked, setEmailAsked] = useState(false);

  return (
    <div className="animate-fade-in mx-auto max-w-xl text-center">
      <div className="relative mx-auto grid h-36 w-36 place-items-center rounded-full bg-[oklch(0.3_0.12_300)] ring-[10px] ring-[oklch(0.45_0.13_300)]">
        <img
          src={THEME_BADGES[themeIdx % THEME_BADGES.length]}
          alt=""
          className="h-16 w-16 object-contain"
        />
        <span aria-hidden="true" className="absolute -top-2 left-2 text-lg">
          ✦
        </span>
        <span aria-hidden="true" className="absolute right-0 bottom-3 text-base">
          ✦
        </span>
      </div>

      <div className="mt-6 font-mono text-[11px] tracking-[0.16em] text-[var(--step-label)] uppercase">
        Theme {themeIdx + 1} of {QUIZ_THEMES.length} complete
      </div>
      <h2 className="mt-2 text-[34px] leading-[1.02] text-[var(--step-fg)]">
        You made it through {theme.title}.
      </h2>
      {next && (
        <p className="mx-auto mt-2 max-w-md text-[15px] text-[var(--step-fg-soft)]">
          Next up: {next.title}. {next.blurb}
        </p>
      )}

      <ul className="mt-7 grid list-none grid-cols-3 gap-3 p-0" aria-label="Your progress so far">
        <XpTile label="This theme" value={`+${themePages * XP_PER_QUIZ_PAGE}`} />
        <XpTile label="Total XP" value={String(totalXp)} />
        <XpTile label="Answered" value={`${answered}/${TOTAL_QUESTIONS}`} />
      </ul>

      {themeIdx + 1 === EMAIL_OFFER_AFTER_THEMES && (
        <div className="mt-8 rounded-[28px] bg-[#0404AC] p-7 text-left text-[oklch(0.99_0.01_85)] sm:p-8">
          <h3 className="text-[24px] leading-tight">Want the rest by email?</h3>
          <p className="mt-3 font-mono text-[13px] leading-relaxed">
            You are two themes in and everything so far is saved.
          </p>
          <p className="mt-3 font-mono text-[13px] leading-relaxed">
            We can send the last ones tomorrow, or you can keep going now.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center gap-2 rounded-full bg-[#7989FF] px-7 py-3 font-mono text-sm font-bold tracking-[0.12em] text-[#0404AC] uppercase transition-transform hover:scale-105 active:scale-95"
            >
              Continue →
            </button>
            <button
              type="button"
              onClick={() => setEmailAsked(true)}
              aria-expanded={emailAsked}
              className="inline-flex items-center rounded-full border-[1.5px] border-[oklch(0.99_0.01_85)] px-6 py-3 font-mono text-xs font-bold tracking-[0.12em] uppercase transition hover:bg-white/10"
            >
              Email the rest
            </button>
          </div>
          {emailAsked && (
            <p role="status" className="animate-fade-in mt-4 text-[13px] leading-relaxed">
              Email reminders are coming soon. Everything so far is saved on this device, so you can
              close this tab and pick up where you left off from the Welcome screen.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function XpTile({ label, value }: { label: string; value: string }) {
  return (
    <li className="rounded-[18px] bg-cream p-2">
      <div className="font-mono text-[10px] font-bold tracking-[0.1em] text-ink uppercase">
        {label}
      </div>
      <div className="mt-1.5 flex items-center justify-center gap-1 rounded-[12px] bg-ink py-3 font-mono text-lg font-bold text-cream">
        <span aria-hidden="true">⚡</span>
        {value}
      </div>
    </li>
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
              background: `linear-gradient(to right, var(--color-ink) ${pct}%, oklch(0.88 0.02 85) ${pct}%)`,
            }}
          />
          <div aria-hidden="true" className="cer-scale-ticks">
            {scale.map((_, i) => (
              <span
                key={i}
                style={{
                  left: `${max ? (i / max) * 100 : 0}%`,
                  background: i <= value ? "var(--color-ink)" : "oklch(0.16 0.02 280 / 0.3)",
                }}
              />
            ))}
          </div>
          <div aria-hidden="true" className="cer-scale-labels">
            {scale.map((label, i) => (
              <span
                key={i}
                style={{
                  color: i === value ? "var(--color-ink)" : "oklch(0.16 0.02 280 / 0.55)",
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

// Memoized so slider drags (which change `answers`, not the page) don't
// re-render every dot on each tick.
const QuizProgressDots = memo(function QuizProgressDots({ current }: { current: number }) {
  return (
    <div className="mt-8" aria-hidden="true">
      <div className="flex flex-wrap items-center gap-1">
        {QUIZ_PAGES.map((p, i) => (
          <span
            key={i}
            className="h-1.5 w-4 rounded-full transition-all duration-300"
            style={{
              background:
                i < current
                  ? "var(--color-ink)"
                  : i === current
                    ? "var(--color-primary)"
                    : "oklch(0.16 0.02 280 / 0.15)",
              marginLeft: i > 0 && QUIZ_PAGES[i - 1].themeIdx !== p.themeIdx ? 6 : 0,
            }}
          />
        ))}
      </div>
    </div>
  );
});
