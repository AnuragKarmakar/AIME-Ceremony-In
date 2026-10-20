import { memo, useState } from "react";
import { FormNav } from "@/components/FormNav";
import { SaveNote } from "@/components/SaveNote";
import type { QuizScale } from "@/lib/quiz.data";
import {
  PAGE_TO_SCREEN,
  QUIZ_PAGES,
  QUIZ_SCREENS,
  QUIZ_THEMES,
  XP_PER_QUIZ_PAGE,
  type QuizPage,
  type QuizTheme,
} from "@/lib/quiz.pages";

/** Screen holding a page, clamped so a stale saved index can't fall out of range. */
const screenOf = (pageIdx: number) =>
  PAGE_TO_SCREEN[Math.min(Math.max(pageIdx, 0), QUIZ_PAGES.length - 1)];

const TOTAL_QUESTIONS = QUIZ_PAGES.reduce((n, p) => n + p.questionCount, 0);

/** Badge shown on each theme's reward screen, in theme order. */
const THEME_BADGES = [
  "/design/badge-star.png",
  "/design/badge-tick.png",
  "/design/badge-smiley.png",
  "/design/badge-hoodie.png",
  "/design/badge-star.png",
];

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
  /** Index of the first page on the current screen. Owned by the parent so it survives a refresh. */
  pageIdx: number;
  setPageIdx: (updater: (i: number) => number) => void;
  totalXp: number;
  onBack: () => void;
  onFinish: () => void;
  /** Called once per completed screen with its last page index, to award XP for every page up to it. */
  onPageComplete: (pageIdx: number) => void;
}) {
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  // Theme whose reward screen is showing, between its last screen and the next theme.
  const [rewardTheme, setRewardTheme] = useState<number | null>(null);

  const screenIdx = screenOf(pageIdx);
  const screen = QUIZ_SCREENS[screenIdx];
  const lastPageIdx = screen.pageIdxs[screen.pageIdxs.length - 1];
  const isFirst = screenIdx === 0;
  const isLast = screenIdx === QUIZ_SCREENS.length - 1;
  const isThemeEnd = QUIZ_SCREENS[screenIdx + 1]?.themeIdx !== screen.themeIdx;

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
    setPageIdx((i) => QUIZ_SCREENS[Math.max(screenOf(i) - 1, 0)].pageIdxs[0]);
    scrollTop();
  };

  const advanceScreen = () => {
    setRewardTheme(null);
    setDirection("forward");
    setPageIdx((i) => QUIZ_SCREENS[Math.min(screenOf(i) + 1, QUIZ_SCREENS.length - 1)].pageIdxs[0]);
    scrollTop();
  };

  const goNext = () => {
    if (rewardTheme !== null) {
      advanceScreen();
      return;
    }
    onPageComplete(lastPageIdx);
    if (isLast) {
      onFinish();
      return;
    }
    if (isThemeEnd) {
      setDirection("forward");
      setRewardTheme(screen.themeIdx);
      scrollTop();
      return;
    }
    advanceScreen();
  };

  if (rewardTheme !== null) {
    return (
      <>
        <ThemeReward
          themeIdx={rewardTheme}
          totalXp={totalXp}
          answered={QUIZ_PAGES.slice(0, lastPageIdx + 1).reduce((n, p) => n + p.questionCount, 0)}
          onContinue={advanceScreen}
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

  const theme = QUIZ_THEMES[screen.themeIdx];
  const pair = screen.pageIdxs.length > 1;
  const xpForScreen = screen.pageIdxs.length * XP_PER_QUIZ_PAGE;

  return (
    <>
      <div
        key={screenIdx}
        className={`${direction === "forward" ? "animate-step-forward" : "animate-step-back"} grid items-stretch gap-6 pb-24 ${
          pair ? "min-[900px]:grid-cols-2" : ""
        }`}
      >
        {screen.pageIdxs.map((pi, n) => (
          <QuizCard
            key={pi}
            showHeader={n === 0}
            page={QUIZ_PAGES[pi]}
            themeIdx={screen.themeIdx}
            theme={theme}
            single={!pair}
            answers={answers}
            setAnswer={setAnswer}
          />
        ))}
      </div>

      <div className="mx-auto mt-6 max-w-xl">
        <QuizProgressDots current={screenIdx} />
        <SaveNote className="mt-5 text-[var(--step-fg-soft)]" />
      </div>

      <FormNav
        onBack={goPrev}
        backLabel={isFirst ? "Back to your Ceremony" : "Back"}
        onNext={goNext}
        nextLabel={isLast ? "Continue" : "Next"}
        label={`Screen ${screenIdx + 1} of ${QUIZ_SCREENS.length} · +${xpForScreen} XP`}
      />
    </>
  );
}

function QuizCard({
  page,
  themeIdx,
  theme,
  single,
  showHeader,
  answers,
  setAnswer,
}: {
  page: QuizPage;
  themeIdx: number;
  theme: QuizTheme;
  /** A lone card (odd page count in a theme) is centered at a readable width. */
  single: boolean;
  /** The theme label and blurb appear once per screen, on the first card. */
  showHeader: boolean;
  answers: Record<string, number>;
  setAnswer: (id: string, value: number) => void;
}) {
  return (
    <div
      className={`ceremony-card h-full w-full overflow-x-clip p-7 sm:p-10 min-[900px]:p-8 ${
        single ? "mx-auto max-w-xl min-[900px]:p-10" : ""
      }`}
    >
      {showHeader && (
        <>
          <div className="font-mono text-[11px] tracking-[0.16em] text-secondary uppercase">
            Theme {themeIdx + 1} of {QUIZ_THEMES.length} — {theme.title}
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink/70">{theme.blurb}</p>
        </>
      )}

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
              <p className="mt-2 text-[13px] leading-relaxed text-ink/75">{block.section.intro}</p>
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

      <SaveNote className="mx-auto mt-7 max-w-md justify-center text-left text-[var(--step-fg-soft)]" />
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
    <div aria-hidden="true">
      <div className="flex flex-wrap items-center gap-1">
        {QUIZ_SCREENS.map((sc, i) => (
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
              marginLeft: i > 0 && QUIZ_SCREENS[i - 1].themeIdx !== sc.themeIdx ? 6 : 0,
            }}
          />
        ))}
      </div>
    </div>
  );
});
