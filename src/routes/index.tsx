import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { evaluateStory, type EvaluationResult } from "@/lib/evaluate.functions";
import { submitCeremony } from "@/lib/submit.functions";
import {
  fetchAgreements,
  fetchVisaPaths,
  type AgreementContent,
  type VisaPathContent,
} from "@/lib/wagtail.functions";
import { LanguageCombobox } from "@/components/LanguageCombobox";
import { QuizScreen } from "@/components/QuizScreen";
import { AgreementsScreen } from "@/components/AgreementsScreen";
import { AmbientBackground } from "@/components/AmbientBackground";
import { SplashScreen } from "@/components/SplashScreen";
import { XpToast } from "@/components/XpToast";
import { DEFAULT_QUIZ_ANSWERS } from "@/lib/quiz.data";
import {
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Lock,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: CeremonyIn,
});

type StepKey =
  "welcome" | "path" | "identity" | "story" | "result" | "quiz" | "agreements" | "journey";

// The Ceremony (result) step sits before the quiz on purpose: an applicant
// who doesn't pass the reflection evaluation (canProceed === false) never
// reaches the Relational Check-in survey. Agreements sit after the quiz and
// before River Run.
const STEPS: { key: StepKey; label: string }[] = [
  { key: "welcome", label: "Welcome" },
  { key: "path", label: "Visa Path" },
  { key: "identity", label: "Who you are" },
  { key: "story", label: "Your story" },
  { key: "result", label: "Ceremony" },
  { key: "quiz", label: "Relational Check-in" },
  { key: "agreements", label: "Agreements" },
  { key: "journey", label: "River Run" },
];

type PathId = "joy-corp" | "presidents" | "schools" | "systems" | "iksl";

const PATHS: {
  id: PathId;
  name: string;
  tagline: string;
  description: string;
  mono: string;
  swatch: string;
  banner: string;
}[] = [
  {
    id: "joy-corp",
    name: "Joy Corp",
    tagline: "For organisations rewriting how business feels",
    description: "Companies redesigning around relational value, mentoring and joy.",
    mono: "JC",
    swatch: "oklch(0.70 0.14 45)",
    banner: "/design/path-joy-corp.jpeg",
  },
  {
    id: "presidents",
    name: "IMAGI-NATION Presidents",
    tagline: "For young leaders imagining new nations",
    description: "Young people age 13 to 18 leading unreasonable, world changing projects.",
    mono: "IP",
    swatch: "oklch(0.82 0.14 88)",
    banner: "/design/path-presidents.jpeg",
  },
  {
    id: "schools",
    name: "IMAGI-NATION Schools",
    tagline: "For classrooms that mentor forward",
    description: "Schools weaving imagination and mentoring into how learning happens.",
    mono: "IS",
    swatch: "oklch(0.70 0.11 190)",
    banner: "/design/path-schools.png",
  },
  {
    id: "systems",
    name: "Systems Change Citizens",
    tagline: "For everyday change makers",
    description: "Citizens learning to shift the systems around them through mentoring.",
    mono: "SC",
    swatch: "oklch(0.60 0.12 230)",
    banner: "/design/path-systems.jpeg",
  },
  {
    id: "iksl",
    name: "Indigenous Knowledge Systems Labs",
    tagline: "For custodians of ancient future thinking",
    description: "Labs centering Indigenous knowledge as design for the next 100 years.",
    mono: "IK",
    swatch: "oklch(0.58 0.17 30)",
    banner: "/design/path-iksl.jpeg",
  },
];

// Overlays editable copy (name/tagline/description/order) fetched from
// Wagtail onto the hardcoded PATHS. Mono code, swatch and banner always come
// from PATHS — they're presentation, not CMS content. Falls back to PATHS
// untouched whenever the CMS is unset, unreachable, or hasn't returned a
// given path yet, so the app never shows a broken or empty Visa Path screen.
function mergePaths(base: typeof PATHS, cms: VisaPathContent[] | null): typeof PATHS {
  if (!cms || cms.length === 0) return base;
  const bySlug = new Map(cms.map((c) => [c.slug, c]));
  return [...base]
    .map((p) => {
      const c = bySlug.get(p.id);
      return c ? { ...p, name: c.name, tagline: c.tagline, description: c.description } : p;
    })
    .sort((a, b) => (bySlug.get(a.id)?.order ?? 0) - (bySlug.get(b.id)?.order ?? 0));
}

// Placeholder agreement copy, shown until real content is entered in
// Wagtail. Unlike Visa Paths, agreements have no hardcoded presentation
// fields to preserve — the CMS list is used outright once it returns
// anything, and this fallback only covers the CMS being unset/unreachable.
const AGREEMENTS_FALLBACK: AgreementContent[] = [
  {
    slug: "agreement-one",
    order: 1,
    headerTitle: "Ceremony In #? | Agreement One (placeholder)",
    headerDescription: "Placeholder header description.",
    instructionalTitle: "Acknowledging",
    bodyTitle: "Placeholder body title",
    bodyDescription: "This is placeholder text. Real content will be added via the CMS.",
    submissionInstructionTitle: "Submission",
    submissionTitle: "Placeholder Submission Title",
    submissionDescription: "Placeholder submission description.",
    statements: [
      { id: 1, text: "Placeholder statement one." },
      { id: 2, text: "Placeholder statement two." },
    ],
  },
  {
    slug: "agreement-two",
    order: 2,
    headerTitle: "Ceremony In #? | Agreement Two (placeholder)",
    headerDescription: "Placeholder header description.",
    instructionalTitle: "Acknowledging",
    bodyTitle: "Placeholder body title",
    bodyDescription: "This is placeholder text. Real content will be added via the CMS.",
    submissionInstructionTitle: "Submission",
    submissionTitle: "Placeholder Submission Title",
    submissionDescription: "Placeholder submission description.",
    statements: [
      { id: 1, text: "Placeholder statement one." },
      { id: 2, text: "Placeholder statement two." },
    ],
  },
];

type Being = { name: string; note: string };

const BEING_PLACEHOLDERS = [
  "e.g. My grandmother Nan",
  "e.g. A future child not yet born",
  "e.g. The river near my home",
  "e.g. Octavia Butler",
];

type FormState = {
  goldenTicket: string;
  path: PathId | null;
  firstName: string;
  lastName: string;
  email: string;
  motherTongue: string;
  city: string;
  country: string;
  story: string;
  beings: [Being, Being, Being, Being];
  quizAnswers: Record<string, number>;
  agreementsAccepted: Record<string, boolean>;
};

function CeremonyIn() {
  const [stepIdx, setStepIdx] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const step = STEPS[stepIdx].key;

  // Gently return to the top whenever the step changes so each screen
  // starts in view instead of wherever the last one was scrolled to.
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }, [stepIdx]);
  // Lazy initializer: the object literal below (including the beings array)
  // is only ever constructed once, on mount, instead of being rebuilt and
  // discarded on every re-render.
  const [form, setForm] = useState<FormState>(() => ({
    goldenTicket: "",
    path: null,
    firstName: "",
    lastName: "",
    email: "",
    motherTongue: "",
    city: "",
    country: "",
    story: "",
    beings: [
      { name: "", note: "" },
      { name: "", note: "" },
      { name: "", note: "" },
      { name: "", note: "" },
    ],
    quizAnswers: DEFAULT_QUIZ_ANSWERS,
    agreementsAccepted: {},
  }));

  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const runEvaluate = useServerFn(evaluateStory);
  const runSubmit = useServerFn(submitCeremony);

  // Guards against storing the same applicant twice if they navigate back and
  // forward through the end of the flow.
  const submittedRef = useRef(false);

  const runFetchVisaPaths = useServerFn(fetchVisaPaths);
  const { data: cmsVisaPaths } = useQuery({
    queryKey: ["visa-paths"],
    queryFn: () => runFetchVisaPaths(),
    staleTime: 60_000,
  });
  const paths = mergePaths(PATHS, cmsVisaPaths ?? null);

  const runFetchAgreements = useServerFn(fetchAgreements);
  const { data: cmsAgreements } = useQuery({
    queryKey: ["agreements"],
    queryFn: () => runFetchAgreements(),
    staleTime: 60_000,
  });
  const agreements =
    cmsAgreements && cmsAgreements.length > 0
      ? [...cmsAgreements].sort((a, b) => a.order - b.order)
      : AGREEMENTS_FALLBACK;

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Not memoized: every check here is a handful of cheap string ops, and
  // `form` changes on every keystroke anyway (the only step where this
  // matters), so a useMemo would never hit its cache in practice.
  let canAdvance = true;
  let blockedReason = "";
  if (step === "path") {
    canAdvance = form.path !== null;
    if (!canAdvance) blockedReason = "Choose a visa path to continue.";
  } else if (step === "identity") {
    canAdvance = Boolean(
      form.firstName.trim() &&
      form.lastName.trim() &&
      /\S+@\S+\.\S+/.test(form.email) &&
      form.motherTongue.trim() &&
      form.city.trim() &&
      form.country.trim(),
    );
    if (!canAdvance) blockedReason = "Fill in every required field, including a valid email.";
  } else if (step === "story") {
    canAdvance =
      form.story.trim().length >= 10 &&
      form.beings.every((b) => b.name.trim().length > 0) &&
      !evaluating;
    if (!canAdvance) {
      const missingBeings = 4 - form.beings.filter((b) => b.name.trim()).length;
      blockedReason =
        form.story.trim().length < 10
          ? "Write at least a sentence of your reflection."
          : missingBeings > 0
            ? `Name ${missingBeings} more being${missingBeings === 1 ? "" : "s"} to continue.`
            : "";
    }
  } else if (step === "result") canAdvance = evaluation?.canProceed !== false;

  // Stable reference so the memoized QuizQuestionRow children only re-render
  // when their own value changes, not on every sibling slider drag.
  const setQuizAnswer = useCallback((id: string, v: number) => {
    setForm((f) => ({ ...f, quizAnswers: { ...f.quizAnswers, [id]: v } }));
  }, []);

  const setAgreementAccepted = useCallback((key: string, v: boolean) => {
    setForm((f) => ({ ...f, agreementsAccepted: { ...f.agreementsAccepted, [key]: v } }));
  }, []);

  const goTo = (key: StepKey) => {
    const target = STEPS.findIndex((s) => s.key === key);
    setDirection(target >= stepIdx ? "forward" : "back");
    setStepIdx(target);
  };

  // Stores the applicant exactly once, at whichever point their journey ends:
  // straight after a blocking verdict, or after Agreements (the last step
  // before River Run) for everyone who gets that far.
  //
  // Deliberately never blocks navigation. The applicant has finished the
  // ceremony either way, and a storage outage should not strand them on the
  // last screen.
  //
  // NOTE: does not yet include form.agreementsAccepted — the middleware's
  // schema (submit.functions.ts / aime-mdlwr) has no field for it. Adding
  // one needs a coordinated change on that side too, not just here.
  const storeSubmission = async (
    result: EvaluationResult | null,
    quizAnswers?: Record<string, number>,
  ) => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    try {
      await runSubmit({
        data: {
          goldenTicket: form.goldenTicket,
          path: form.path,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          motherTongue: form.motherTongue,
          city: form.city,
          country: form.country,
          story: form.story,
          beings: form.beings.map((b) => ({ name: b.name, note: b.note })),
          ...(quizAnswers ? { quizAnswers } : {}),
          ...(result ? { evaluation: result } : {}),
        },
      });
    } catch (e) {
      // Allow a later attempt rather than losing the applicant entirely.
      submittedRef.current = false;
      console.error("Could not store the ceremony submission.", e);
    }
  };

  const [showXpToast, setShowXpToast] = useState(false);
  const xpToastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const popXpToast = () => {
    setShowXpToast(true);
    clearTimeout(xpToastTimer.current);
    xpToastTimer.current = setTimeout(() => setShowXpToast(false), 1400);
  };

  const next = async () => {
    setDirection("forward");
    if (step === "agreements") {
      void storeSubmission(evaluation, form.quizAnswers);
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
      popXpToast();
      return;
    }
    if (step === "story") {
      setEvaluating(true);
      setEvalError(null);
      try {
        const result = await runEvaluate({
          data: {
            story: form.story,
            path: form.path,
            name: `${form.firstName} ${form.lastName}`.trim(),
            goldenTicket: form.goldenTicket,
            beings: form.beings
              .map((b) =>
                b.note.trim()
                  ? `${b.name.trim()} (note: ${b.note.trim()})`
                  : `${b.name.trim()} (no note given)`,
              )
              .filter(Boolean),
          },
        });
        setEvaluation(result);
        // A blocked applicant never reaches the quiz, so this is the only
        // chance to record them.
        if (!result.canProceed) {
          void storeSubmission(result);
        }
        goTo("result");
        popXpToast();
      } catch (e) {
        setEvalError(
          e instanceof Error ? e.message : "Something went wrong while reading your reflection.",
        );
      } finally {
        setEvaluating(false);
      }
      return;
    }
    setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
    popXpToast();
  };
  const back = () => {
    setDirection("back");
    setStepIdx((i) => Math.max(i - 1, 0));
  };

  // The identity badge (name + Visa Path) appears in the header once the
  // applicant has moved past the "Who you are" step, replacing the small
  // card that used to sit above the reflection input.
  const identityIdx = STEPS.findIndex((s) => s.key === "identity");
  const storyIdx = STEPS.findIndex((s) => s.key === "story");
  const quizIdx = STEPS.findIndex((s) => s.key === "quiz");
  const agreementsIdx = STEPS.findIndex((s) => s.key === "agreements");
  const showIdentityBadge = stepIdx > identityIdx;
  const fullName = `${form.firstName} ${form.lastName}`.trim();
  const pathName = paths.find((p) => p.id === form.path)?.name ?? null;

  return (
    <>
      <SplashScreen />
      <AmbientBackground step={step} />
      <XpToast show={showXpToast} />
      <main className="relative z-[1] mx-auto flex min-h-dvh max-w-3xl flex-col px-5 py-[52px] pb-[90px]">
        <CeremonyHeader
          onHome={() => goTo("welcome")}
          name={showIdentityBadge ? fullName : null}
          pathName={showIdentityBadge ? pathName : null}
          stepIdx={stepIdx}
          totalSteps={STEPS.length}
          stepLabel={STEPS[stepIdx].label}
          identityDone={stepIdx > identityIdx}
          storyDone={stepIdx > storyIdx}
          checkinDone={stepIdx > quizIdx}
          agreementsDone={stepIdx > agreementsIdx}
        />

        <section className="mt-8 flex-1 overflow-x-clip">
          <div
            key={stepIdx}
            className={direction === "forward" ? "animate-step-forward" : "animate-step-back"}
          >
            {step === "welcome" && (
              <WelcomeScreen
                golden={form.goldenTicket}
                setGolden={(v) => setField("goldenTicket", v)}
                onBegin={next}
              />
            )}
            {step === "path" && (
              <PathScreen
                paths={paths}
                selected={form.path}
                onSelect={(p) => setField("path", p)}
              />
            )}
            {step === "identity" && <IdentityScreen form={form} setField={setField} />}
            {step === "story" && (
              <StoryScreen
                story={form.story}
                setStory={(v) => setField("story", v)}
                beings={form.beings}
                setBeing={(i, patch) =>
                  setForm((f) => {
                    const next = [...f.beings] as FormState["beings"];
                    next[i] = { ...next[i], ...patch };
                    return { ...f, beings: next };
                  })
                }
                evaluating={evaluating}
                error={evalError}
              />
            )}
            {step === "result" && (
              <ResultScreen paths={paths} form={form} evaluation={evaluation} />
            )}
            {step === "quiz" && (
              <QuizScreen
                answers={form.quizAnswers}
                setAnswer={setQuizAnswer}
                onBack={back}
                onFinish={next}
              />
            )}
            {step === "agreements" && (
              <AgreementsScreen
                agreements={agreements}
                accepted={form.agreementsAccepted}
                setAccepted={setAgreementAccepted}
                onBack={back}
                onFinish={next}
              />
            )}
            {step === "journey" && <JourneyScreen form={form} />}
          </div>
        </section>

        {step !== "welcome" && step !== "quiz" && step !== "agreements" && (
          <NavBar
            canAdvance={canAdvance}
            onBack={back}
            onNext={next}
            isLast={stepIdx === STEPS.length - 1}
            step={step}
            evaluating={evaluating}
            blockedReason={blockedReason}
          />
        )}
      </main>
    </>
  );
}

/* ------------------------- Header ------------------------- */

function CeremonyHeader({
  onHome,
  name,
  pathName,
  stepIdx,
  totalSteps,
  stepLabel,
  identityDone,
  storyDone,
  checkinDone,
  agreementsDone,
}: {
  onHome: () => void;
  name?: string | null;
  pathName?: string | null;
  stepIdx: number;
  totalSteps: number;
  stepLabel: string;
  identityDone: boolean;
  storyDone: boolean;
  checkinDone: boolean;
  agreementsDone: boolean;
}) {
  const hasBadge = Boolean(name || pathName);
  const ringPct = Math.round((stepIdx / (totalSteps - 1)) * 100);
  const xp = stepIdx * 100;
  const badges: { label: string; unlocked: boolean; icon: string }[] = [
    { label: "Identity", unlocked: identityDone, icon: "/design/badge-star.png" },
    { label: "Story", unlocked: storyDone, icon: "/design/badge-smiley.png" },
    { label: "Check-in", unlocked: checkinDone, icon: "/design/badge-tick.png" },
    { label: "Agreements", unlocked: agreementsDone, icon: "/design/badge-hoodie.png" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onHome}
          aria-label="Ceremony-In home, return to the first step"
          className="flex shrink-0 items-center gap-3 rounded-full bg-transparent p-0 outline-none transition-transform hover:-rotate-3 hover:scale-[1.06] focus-visible:ring-2 focus-visible:ring-gold"
        >
          <img src="/design/logo-final.png" alt="" className="h-12 w-12 object-contain" />
          <div className="text-left leading-tight">
            <div className="font-mono text-[10px] tracking-[0.18em] text-gold uppercase">
              AIME Imagi-Nation
            </div>
            <div className="font-display text-[22px] text-[oklch(0.99_0.01_85)]">Ceremony-In</div>
          </div>
        </button>
        {hasBadge && (
          <div className="animate-fade-in rounded-full border-[1.5px] border-ink bg-cream px-[18px] py-2 text-right">
            {name && <div className="font-display text-sm text-ink">{name}</div>}
            {pathName && (
              <div className="font-mono text-[9px] tracking-[0.12em] text-secondary uppercase">
                {pathName}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-[18px] flex flex-wrap items-center justify-between gap-2.5">
        <div
          className="inline-flex items-center gap-2.5"
          role="img"
          aria-label={`Progress: ${ringPct} percent complete, ${xp} XP earned`}
        >
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-[background] duration-500"
            style={{
              background: `conic-gradient(var(--color-gold) ${ringPct}%, oklch(0.99 0.01 85 / 0.18) 0)`,
            }}
          >
            <div className="grid h-8 w-8 place-items-center rounded-full bg-background">
              <img src="/design/badge-star.png" alt="" className="h-3.5 w-3.5 object-contain" />
            </div>
          </div>
          <div>
            <div className="font-mono text-[13px] font-bold text-[oklch(0.99_0.01_85)]">
              {xp} XP
            </div>
            <div className="font-mono text-[9px] tracking-[0.06em] text-gold uppercase">
              {ringPct}% complete
            </div>
          </div>
        </div>
        <ul aria-label="Ceremony badges earned" className="flex list-none gap-1.5 p-0">
          {badges.map((b) => (
            <li
              key={b.label}
              className="grid h-[30px] w-[30px] place-items-center rounded-full border-[1.5px] border-ink bg-cream transition-[opacity,filter,transform] duration-400"
              style={{
                opacity: b.unlocked ? 1 : 0.35,
                filter: b.unlocked ? "none" : "grayscale(1)",
                transform: b.unlocked ? "scale(1)" : "scale(0.8)",
              }}
            >
              <img
                src={b.icon}
                alt={`${b.label} badge — ${b.unlocked ? "earned" : "not yet earned"}`}
                className="h-[17px] w-[17px] object-contain"
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3.5">
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-valuenow={stepIdx + 1}
          aria-valuetext={`Level ${stepIdx + 1} of ${totalSteps}: ${stepLabel}`}
          className="flex items-center gap-1.5"
        >
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className="h-1.5 flex-1 rounded-full transition-colors duration-500 ease-out"
              style={{
                background:
                  i < stepIdx
                    ? "var(--color-primary)"
                    : i === stepIdx
                      ? "var(--color-gold)"
                      : "oklch(0.99 0.01 85 / 0.25)",
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] tracking-[0.14em] text-[oklch(0.92_0.03_85_/_0.92)] uppercase">
          <span>
            Level {stepIdx + 1} of {totalSteps}
          </span>
          <span className="text-gold">{stepLabel}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------- 1. Welcome ------------------------- */

function WelcomeScreen({
  golden,
  setGolden,
  onBegin,
}: {
  golden: string;
  setGolden: (v: string) => void;
  onBegin: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ceremony-card mx-auto max-w-xl p-8 sm:p-11">
      <div className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-ink px-3.5 py-1.5 font-mono text-[10px] tracking-[0.1em] text-ink uppercase">
        <span aria-hidden="true">✦</span> You are welcome here
      </div>
      <h1 className="mt-5 text-[46px] leading-[0.98] text-ink">
        Step into the <span className="text-primary">Ceremony-In</span>.
      </h1>
      <p className="mt-4 max-w-md text-base leading-relaxed text-ink/65">
        This is where you meet the movement. A few gentle questions, a story you bring with you, and
        a path chosen with care. No forms that feel like forms.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          onClick={onBegin}
          className="cer-cta inline-flex items-center gap-2 rounded-full bg-primary px-[30px] py-4 text-[15px] font-bold text-primary-foreground"
        >
          Begin Ceremony-In →
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="golden-ticket-panel"
          className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-ink px-[22px] py-3.5 text-sm font-semibold text-ink transition hover:bg-primary-soft"
        >
          <span aria-hidden="true">🎫</span> I have a Golden Ticket
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div
          id="golden-ticket-panel"
          className="animate-fade-in mt-5 rounded-2xl border-[1.5px] border-gold bg-cream p-5"
        >
          <label className="block">
            <span className="block font-mono text-[10px] tracking-[0.12em] text-secondary uppercase">
              Golden ticket or referral code
            </span>
            <input
              value={golden}
              onChange={(e) => setGolden(e.target.value)}
              placeholder="e.g. RIVER-SUNRISE-2026"
              aria-describedby="golden-ticket-help"
              className="mt-2 w-full rounded-xl border-[1.5px] border-ink/25 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/25"
            />
          </label>
          <p id="golden-ticket-help" className="mt-2 text-xs text-ink/70">
            Optional. A Golden Ticket unlocks mentor invitations and early stages on the River Run.
          </p>
        </div>
      )}

      <div className="mt-9 flex flex-wrap gap-2.5">
        <div className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-ink px-3.5 py-[7px] font-mono text-[10px] tracking-[0.08em] text-ink uppercase">
          5 Visa Paths
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-ink px-3.5 py-[7px] font-mono text-[10px] tracking-[0.08em] text-ink uppercase">
          8 Ceremony Steps
        </div>
      </div>
    </div>
  );
}

/* ------------------------- 2. Visa Path ------------------------- */

function PathScreen({
  paths,
  selected,
  onSelect,
}: {
  paths: typeof PATHS;
  selected: PathId | null;
  onSelect: (p: PathId) => void;
}) {
  const [carouselIdx, setCarouselIdx] = useState(() => {
    const si = paths.findIndex((p) => p.id === selected);
    return si >= 0 ? si : Math.min(2, paths.length - 1);
  });
  const active = paths[carouselIdx];
  const atStart = carouselIdx === 0;
  const atEnd = carouselIdx === paths.length - 1;

  const setActive = (i: number) => setCarouselIdx(Math.max(0, Math.min(paths.length - 1, i)));
  const choose = (i: number) => {
    setActive(i);
    onSelect(paths[i].id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActive(carouselIdx - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setActive(carouselIdx + 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(paths.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(carouselIdx);
    }
  };

  const activeChosen = selected === active.id;

  return (
    <div>
      <div className="mx-auto max-w-xl">
        <div className="font-mono text-[11px] tracking-[0.16em] text-gold uppercase">
          Choose a visa path
        </div>
        <h2 className="mt-2 text-[34px] leading-[1.02] text-[oklch(0.99_0.01_85)]">
          Which doorway feels most like yours?
        </h2>
        <p className="mt-2 text-[15px] text-[oklch(0.95_0.02_85_/_0.88)]">
          Pick the one that fits today. You can carry more than one over time.
        </p>
      </div>

      <div className="relative mt-8">
        <div
          className="relative h-[300px] sm:h-[380px]"
          style={{ perspective: "1200px" }}
          tabIndex={0}
          role="group"
          aria-label="Visa path carousel. Click a card to choose it, or use left and right arrow keys to browse."
          onKeyDown={onKeyDown}
        >
          {paths.map((p, i) => {
            const offset = i - carouselIdx;
            const abs = Math.abs(offset);
            const scale = offset === 0 ? 1 : abs === 1 ? 0.82 : 0.66;
            const rotateY = Math.max(-30, Math.min(30, offset * -26));
            const translateX = offset * 190;
            const opacity = abs > 2 ? 0 : offset === 0 ? 1 : abs === 1 ? 0.75 : 0.42;
            const isChosen = selected === p.id;
            return (
              <button
                key={p.id}
                onClick={() => choose(i)}
                aria-label={p.name}
                aria-pressed={isChosen}
                className="absolute top-1/2 left-1/2 -ml-[136px] -mt-[167px] h-[334px] w-[272px] cursor-pointer overflow-hidden rounded-[22px] border-none bg-cream p-0 transition-[transform,opacity,box-shadow] duration-500"
                style={{
                  boxShadow: isChosen
                    ? "0 0 0 3px var(--color-gold)"
                    : "0 14px 34px -16px oklch(0.1 0.06 300 / 0.5)",
                  transform: `translateX(${translateX}px) rotateY(${rotateY}deg) scale(${scale})`,
                  opacity,
                  zIndex: 100 - abs,
                  pointerEvents: abs > 2 ? "none" : "auto",
                }}
              >
                <img src={p.banner} alt="" className="block h-full w-full object-cover" />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(0deg, oklch(0.1 0.05 300 / 0.92), transparent 46%)",
                  }}
                />
                <div
                  className="absolute top-3.5 left-3.5 grid h-[38px] w-[38px] place-items-center rounded-full border-2 border-ink font-mono text-xs font-bold text-ink"
                  style={{ background: p.swatch }}
                >
                  {p.mono}
                </div>
                <div className="absolute right-4 bottom-4 left-4 text-left text-[22px] leading-[1.02] text-[oklch(0.99_0.01_85)]">
                  {p.name}
                </div>
                {isChosen && (
                  <div
                    aria-hidden="true"
                    className="absolute top-3 right-3 grid h-[26px] w-[26px] place-items-center rounded-full bg-gold text-[13px] font-bold text-ink"
                  >
                    ✓
                  </div>
                )}
              </button>
            );
          })}

          <button
            onClick={() => setActive(carouselIdx - 1)}
            disabled={atStart}
            aria-label="Previous visa path"
            className="absolute top-1/2 left-0 z-[200] grid h-[38px] w-[38px] -mt-[19px] place-items-center rounded-full border-[1.5px] border-ink bg-cream text-base shadow-[0_6px_16px_-8px_oklch(0.1_0.05_300_/_0.5)] transition-transform hover:scale-[1.15] active:scale-[0.85]"
            style={{ opacity: atStart ? 0.3 : 1 }}
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            onClick={() => setActive(carouselIdx + 1)}
            disabled={atEnd}
            aria-label="Next visa path"
            className="absolute top-1/2 right-0 z-[200] grid h-[38px] w-[38px] -mt-[19px] place-items-center rounded-full border-[1.5px] border-ink bg-cream text-base shadow-[0_6px_16px_-8px_oklch(0.1_0.05_300_/_0.5)] transition-transform hover:scale-[1.15] active:scale-[0.85]"
            style={{ opacity: atEnd ? 0.3 : 1 }}
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>

        <div
          className="mt-2.5 flex justify-center gap-1.5"
          role="group"
          aria-label="Jump to a visa path"
        >
          {paths.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActive(i)}
              aria-label={`Show ${p.name}`}
              aria-current={i === carouselIdx}
              className="grid h-6 min-w-6 place-items-center rounded-full border-none bg-transparent px-1 transition-transform hover:scale-y-[1.4] active:scale-[0.85]"
            >
              <span
                aria-hidden="true"
                className="block h-2 rounded-full transition-[width] duration-300"
                style={{
                  width: i === carouselIdx ? "22px" : "8px",
                  background:
                    i === carouselIdx ? "var(--color-primary)" : "oklch(0.95 0.02 85 / 0.45)",
                }}
              />
            </button>
          ))}
        </div>

        <div className="animate-fade-in mx-auto mt-[26px] max-w-[420px] text-center">
          <div className="text-2xl text-[oklch(0.99_0.01_85)]">{active.name}</div>
          <div className="mt-1 font-mono text-[11px] tracking-[0.06em] text-gold">
            {active.tagline}
          </div>
          <p className="mt-3.5 text-sm leading-relaxed text-[oklch(0.95_0.02_85_/_0.88)]">
            {active.description}
          </p>
          <button
            onClick={() => choose(carouselIdx)}
            aria-pressed={activeChosen}
            className="mt-[18px] inline-flex items-center gap-2 rounded-full border-2 px-[26px] py-3.5 text-sm font-bold transition-transform hover:scale-105 active:scale-[0.93]"
            style={{
              borderColor: activeChosen ? "var(--color-gold)" : "oklch(0.95 0.02 85 / 0.6)",
              background: activeChosen ? "var(--color-gold)" : "transparent",
              color: activeChosen ? "var(--color-ink)" : "oklch(0.99 0.01 85)",
            }}
          >
            {activeChosen ? `✓ ${active.name} chosen` : `Choose ${active.name}`}
          </button>
          <div className="mx-auto mt-[22px] flex flex-col gap-2.5 border-t border-[oklch(0.95_0.02_85_/_0.15)] pt-4">
            <div className="flex justify-between text-xs">
              <span className="text-[oklch(0.95_0.02_85_/_0.75)]">Visa Path</span>
              <span className="font-bold text-[oklch(0.99_0.01_85)]">{active.name}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[oklch(0.95_0.02_85_/_0.75)]">Status</span>
              <span
                className="font-bold"
                style={{ color: activeChosen ? "var(--color-gold)" : "oklch(0.95 0.02 85 / 0.8)" }}
              >
                {activeChosen ? "✓ Chosen" : "Not selected yet"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------- 3a. Identity ------------------------- */

function IdentityScreen({
  form,
  setField,
}: {
  form: FormState;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  return (
    <div className="ceremony-card mx-auto max-w-xl p-7 sm:p-10">
      <SectionHeader
        eyebrow="A few gentle details"
        title="Tell us who is arriving."
        subtitle="Just the basics. Your story comes next. Fields marked with an asterisk are required."
      />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="First name" required>
          <input
            value={form.firstName}
            onChange={(e) => setField("firstName", e.target.value)}
            placeholder="Ada"
            autoComplete="given-name"
            className={inputCx}
          />
        </Field>
        <Field label="Last name" required>
          <input
            value={form.lastName}
            onChange={(e) => setField("lastName", e.target.value)}
            placeholder="Aroha"
            autoComplete="family-name"
            className={inputCx}
          />
        </Field>
        <Field label="Email" required>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            placeholder="you@village.earth"
            autoComplete="email"
            className={inputCx}
          />
        </Field>
        <Field label="Mother tongue" required>
          <LanguageCombobox
            value={form.motherTongue}
            onChange={(v: string) => setField("motherTongue", v)}
          />
        </Field>
        <Field label="City" required>
          <input
            value={form.city}
            onChange={(e) => setField("city", e.target.value)}
            placeholder="Sydney"
            autoComplete="address-level2"
            className={inputCx}
          />
        </Field>
        <Field label="Country" required>
          <input
            value={form.country}
            onChange={(e) => setField("country", e.target.value)}
            placeholder="Australia"
            autoComplete="country-name"
            className={inputCx}
          />
        </Field>
      </div>
    </div>
  );
}

/* ------------------------- 3b. Story ------------------------- */

function StoryScreen({
  story,
  setStory,
  beings,
  setBeing,
  evaluating,
  error,
}: {
  story: string;
  setStory: (v: string) => void;
  beings: [Being, Being, Being, Being];
  setBeing: (i: number, patch: Partial<Being>) => void;
  evaluating: boolean;
  error: string | null;
}) {
  const namedCount = beings.filter((b) => b.name.trim().length > 0).length;
  return (
    <div className="ceremony-card mx-auto max-w-xl p-7 sm:p-10">
      <SectionHeader
        eyebrow="Your reflection"
        title="What brought you to the river?"
        subtitle="A paragraph is plenty. Write like you are talking to a mentor."
      />

      <div className="mt-[18px]">
        <textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={7}
          placeholder="I keep noticing that..."
          disabled={evaluating}
          aria-label="What brought you to the river?"
          aria-describedby="story-help"
          className="min-h-[160px] w-full resize-y rounded-[18px] border-[1.5px] border-ink/25 bg-white p-4 text-[15px] leading-relaxed text-ink outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/25 disabled:opacity-60"
        />
        <div id="story-help" className="mt-2 flex justify-between gap-3 text-xs text-ink/70">
          <span>Written from the heart, not for the algorithm. At least 10 characters.</span>
          <span aria-live="polite">{story.trim().length} characters</span>
        </div>

        <div className="mt-7 rounded-[22px] bg-primary-soft p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] tracking-[0.12em] text-secondary uppercase">
                A relational welcome
              </div>
              <h3 className="mt-1.5 text-[21px] leading-snug text-ink">
                Name four beings you bring with you.
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink/60">
                Not yourself. Four others whose presence walks beside you into Imagination — past,
                present or future, human or more than human.
              </p>
            </div>
            <div
              aria-live="polite"
              className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold"
              style={{
                background: namedCount === 4 ? "var(--color-gold)" : "oklch(0.9 0.01 85)",
                color: namedCount === 4 ? "var(--color-ink)" : "oklch(0.16 0.02 280 / 0.5)",
              }}
            >
              {namedCount} of 4 named
            </div>
          </div>

          <div className="mt-4 grid gap-2.5">
            {beings.map((b, i) => (
              <div key={i} className="rounded-2xl bg-[oklch(0.99_0.01_85)] p-3.5">
                <div className="flex items-center gap-2.5">
                  <div
                    aria-hidden="true"
                    className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border-[1.5px] border-ink bg-gold font-mono text-[11px] font-bold text-ink"
                  >
                    {i + 1}
                  </div>
                  <input
                    value={b.name}
                    onChange={(e) => setBeing(i, { name: e.target.value })}
                    placeholder={BEING_PLACEHOLDERS[i]}
                    disabled={evaluating}
                    aria-label={`Being ${i + 1} of 4: name`}
                    className="flex-1 rounded-[10px] border border-ink/20 bg-white px-3 py-2 text-[13px] text-ink outline-none disabled:opacity-60"
                  />
                </div>
                <input
                  value={b.note}
                  onChange={(e) => setBeing(i, { note: e.target.value })}
                  placeholder="Why they walk with you"
                  disabled={evaluating}
                  aria-label={`Being ${i + 1} of 4: why they walk with you (optional)`}
                  className="mt-2 w-full border-none bg-transparent px-3 py-1 text-xs text-ink/80 outline-none disabled:opacity-60"
                />
              </div>
            ))}
          </div>
        </div>

        {evaluating && (
          <div className="animate-fade-in mt-4 inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-2 text-sm text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading your words...
          </div>
        )}
        {error && !evaluating && (
          <div className="animate-fade-in mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------- 4. Result ------------------------- */

function ResultScreen({
  paths,
  form,
  evaluation,
}: {
  paths: typeof PATHS;
  form: FormState;
  evaluation: EvaluationResult | null;
}) {
  const [open, setOpen] = useState(false);
  const path = paths.find((p) => p.id === form.path);
  const first = form.firstName.trim() || "friend";

  const verdict = evaluation?.verdict ?? "yellow";

  const theme =
    verdict === "green"
      ? {
          Icon: ShieldCheck,
          badge: "You are in",
          badgeCx: "bg-[oklch(0.88_0.1_155)] text-[oklch(0.3_0.1_155)]",
          ring: "border-[oklch(0.7_0.14_155)]",
          title: (
            <>
              Welcome, <span className="text-primary">{first}</span>. The river makes room for you.
            </>
          ),
          body:
            evaluation?.reason ??
            "Your Ceremony-In is complete. A mentor will meet you at the first bend of the River Run.",
        }
      : verdict === "yellow"
        ? {
            Icon: ShieldQuestion,
            badge: "Held with care",
            badgeCx: "bg-[oklch(0.9_0.08_90)] text-[oklch(0.4_0.1_60)]",
            ring: "border-gold",
            title: (
              <>
                Thank you, <span className="text-primary">{first}</span>. A human wants to meet you
                first.
              </>
            ),
            body:
              evaluation?.reason ??
              "Your reflection is thoughtful, and a mentor will read it with their own eyes before you continue down the river.",
          }
        : verdict === "red_flag"
          ? {
              Icon: ShieldAlert,
              badge: "Flagged for review",
              badgeCx: "bg-[oklch(0.9_0.06_30)] text-[oklch(0.45_0.15_25)]",
              ring: "border-[oklch(0.65_0.18_30)]",
              title: (
                <>
                  Thank you, <span className="text-primary">{first}</span>. Your reflection has been
                  flagged for review.
                </>
              ),
              body:
                evaluation?.reason ??
                "You wrote something, and you can continue down the river. An admin will read your reflection because it did not fully meet the ceremony criteria.",
            }
          : {
              Icon: ShieldAlert,
              badge: "Please try again",
              badgeCx: "bg-destructive/15 text-destructive",
              ring: "border-destructive/40",
              title: (
                <>
                  Thank you for arriving, <span className="text-destructive">{first}</span>. Your
                  reflection is not ready yet.
                </>
              ),
              body:
                evaluation?.reason ??
                "Your reflection did not show meaningful engagement with this ceremony. Please go back and share a few honest sentences before continuing.",
            };

  const Icon = theme.Icon;

  return (
    <div className={`ceremony-card mx-auto max-w-xl border-[3px] p-8 sm:p-11 ${theme.ring}`}>
      <div
        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-bold ${theme.badgeCx}`}
      >
        <Icon className="h-4 w-4" />
        {theme.badge}
      </div>
      <h2 className="mt-4.5 text-[38px] leading-[1.02] text-ink">{theme.title}</h2>
      {evaluation?.headline && (
        <p className="mt-3.5 text-lg text-secondary">{evaluation.headline}</p>
      )}
      <p className="mt-3.5 max-w-md text-[15px] leading-relaxed text-ink/78">{theme.body}</p>

      {verdict !== "red_block" && (
        <div className="mt-6 flex flex-wrap gap-2">
          <Tag>Path: {path?.name ?? "Chosen with care"}</Tag>
          {form.motherTongue && <Tag>Speaks: {form.motherTongue}</Tag>}
          {(form.city || form.country) && (
            <Tag>From: {[form.city, form.country].filter(Boolean).join(", ")}</Tag>
          )}
          {form.goldenTicket && <Tag>🎫 Golden Ticket honoured</Tag>}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="result-details-panel"
        className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-secondary"
      >
        {open ? "Hide details" : "View details"}
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          id="result-details-panel"
          className="animate-fade-in mt-3.5 rounded-[18px] bg-[oklch(0.99_0.01_85)] p-5 text-[13px]"
        >
          <dl className="grid gap-2.5 sm:grid-cols-2">
            <Detail k="Name" v={`${form.firstName} ${form.lastName}`.trim()} />
            <Detail k="Email" v={form.email} />
            <Detail k="Mother tongue" v={form.motherTongue} />
            <Detail k="City" v={form.city} />
            <Detail k="Country" v={form.country} />
            <Detail k="Visa Path" v={path?.name ?? ""} />
            <Detail k="Golden Ticket" v={form.goldenTicket} />
            <Detail k="Review verdict" v={verdict} />
          </dl>
          <div className="mt-3">
            <div className="text-[11px] tracking-wider text-ink/60 uppercase">
              Four beings you brought
            </div>
            <ul className="mt-1 space-y-1">
              {form.beings.map((b, i) => (
                <li key={i} className="text-ink">
                  {i + 1}. {b.name || <span className="text-ink/50">(unnamed)</span>}
                  {b.note && <span className="text-ink/60">: {b.note}</span>}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3">
            <div className="text-[11px] tracking-wider text-ink/60 uppercase">Your reflection</div>
            <p className="mt-1 whitespace-pre-wrap text-ink">{form.story}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------- 5. Journey ------------------------- */

function JourneyScreen({ form }: { form: FormState }) {
  const hasGolden = !!form.goldenTicket.trim();
  const xp = 400;
  const stages = [
    { title: "Ceremony-In", note: "You arrived with a story.", state: "done" as const },
    {
      title: "Meet your Mentor",
      note: "A first conversation at the river bend.",
      state: "unlocked" as const,
    },
    {
      title: "Cohort Circle",
      note: "You gather with 6 to 8 fellow travellers.",
      state: hasGolden ? ("unlocked" as const) : ("locked" as const),
    },
    {
      title: "First Ripple Project",
      note: "A small act of imagination in your city.",
      state: "locked" as const,
    },
    {
      title: "River Council",
      note: "You mentor someone through their Ceremony-In.",
      state: "locked" as const,
    },
    {
      title: "Custodian",
      note: "You carry the river forward for the next 100 years.",
      state: "locked" as const,
    },
  ];
  const confetti = [
    { icon: "/design/badge-star.png", left: "6%", w: 20, dur: "1.9s", delay: "0s" },
    { icon: "/design/badge-tick.png", left: "22%", w: 16, dur: "2.2s", delay: "0.15s" },
    { icon: "/design/badge-star.png", left: "40%", w: 14, dur: "1.7s", delay: "0.3s" },
    { icon: "/design/badge-smiley.png", left: "58%", w: 18, dur: "2.4s", delay: "0.05s" },
    { icon: "/design/badge-tick.png", left: "75%", w: 16, dur: "2s", delay: "0.25s" },
    { icon: "/design/badge-star.png", left: "90%", w: 18, dur: "2.1s", delay: "0.1s" },
  ];

  return (
    <div>
      <div className="mx-auto flex max-w-xl items-end justify-between gap-5">
        <div>
          <div className="font-mono text-[11px] tracking-[0.16em] text-gold uppercase">
            River Run
          </div>
          <h2 className="mt-2 text-[32px] leading-[1.02] text-[oklch(0.99_0.01_85)]">
            Your next steps down the river.
          </h2>
          <p className="mt-2 text-sm text-[oklch(0.95_0.02_85_/_0.88)]">
            A gamified mentoring pathway. Move at the pace of trust.
          </p>
          <p className="mt-1.5 font-mono text-[11px] tracking-[0.08em] text-gold uppercase">
            You've earned {xp} XP getting here.
          </p>
        </div>
        <img
          src="/design/passport.png"
          alt=""
          className="w-[84px] shrink-0 rotate-6 drop-shadow-[0_12px_20px_oklch(0.1_0.05_300_/_0.5)]"
        />
      </div>

      <div aria-hidden="true" className="relative mx-auto h-0 max-w-xl overflow-visible">
        {confetti.map((c, i) => (
          <img
            key={i}
            src={c.icon}
            alt=""
            className="absolute -top-1.5"
            style={{
              left: c.left,
              width: c.w,
              animation: `confettiFall ${c.dur} ease-in ${c.delay} both`,
            }}
          />
        ))}
      </div>

      <ol
        aria-label="River Run stages"
        className="mx-auto mt-7 grid max-w-xl list-none gap-3.5 p-0"
      >
        {stages.map((s) => {
          const done = s.state === "done";
          const unlocked = s.state === "unlocked";
          return (
            <li key={s.title} className="flex items-start gap-3.5">
              <div
                aria-hidden="true"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-ink text-base text-ink"
                style={{
                  background: done
                    ? "var(--color-primary)"
                    : unlocked
                      ? "var(--color-gold)"
                      : "oklch(0.9 0.01 85)",
                }}
              >
                {done && (
                  <img
                    src="/design/badge-tick.png"
                    alt=""
                    className="h-[22px] w-[22px] object-contain"
                  />
                )}
                {unlocked && (
                  <img
                    src="/design/badge-star.png"
                    alt=""
                    className="h-[22px] w-[22px] object-contain"
                  />
                )}
                {!done && !unlocked && <Lock className="h-4 w-4" />}
              </div>
              <div
                className="flex-1 rounded-[20px] p-[18px] transition-transform hover:translate-x-[3px] sm:p-5"
                style={{
                  background: done
                    ? "var(--color-primary-soft)"
                    : unlocked
                      ? "var(--color-cream)"
                      : "oklch(0.97 0.03 85 / 0.55)",
                }}
              >
                <div className="flex items-center justify-between gap-2.5">
                  <h3 className="text-[17px] font-normal text-ink">{s.title}</h3>
                  <span
                    className="rounded-full px-3 py-1 text-[10px] font-bold"
                    style={{
                      background: done
                        ? "var(--color-primary)"
                        : unlocked
                          ? "var(--color-gold)"
                          : "oklch(0.85 0.01 85)",
                      color: done ? "var(--color-cream)" : "var(--color-ink)",
                    }}
                  >
                    {done ? "Completed" : unlocked ? "Unlocked" : "Locked"}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-ink/75">{s.note}</p>
                {unlocked && (
                  <button
                    aria-label={`Begin the ${s.title} stage`}
                    className="mt-2.5 rounded-full bg-gold px-4.5 py-2.5 text-xs font-bold text-ink transition-transform hover:scale-105 active:scale-95"
                  >
                    Begin this stage →
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------- Shared bits ------------------------- */

const inputCx =
  "w-full rounded-xl border-[1.5px] border-ink/25 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/25";

function Field({
  label,
  children,
  className = "",
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-1.5 font-mono text-[10px] tracking-[0.1em] text-secondary uppercase">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </div>
      {children}
    </label>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <div className="font-mono text-[11px] tracking-[0.16em] text-secondary uppercase">
        {eyebrow}
      </div>
      <h2 className="mt-2 text-[30px] leading-tight text-ink">{title}</h2>
      {subtitle && <p className="mt-1.5 text-sm text-ink/75">{subtitle}</p>}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3.5 py-1.5 text-xs font-semibold text-secondary">
      {children}
    </span>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[9px] tracking-wider text-ink/62 uppercase">{k}</dt>
      <dd className="mt-0.5 text-ink">{v || "not shared"}</dd>
    </div>
  );
}

function NavBar({
  canAdvance,
  onBack,
  onNext,
  isLast,
  step,
  evaluating,
  blockedReason,
}: {
  canAdvance: boolean;
  onBack: () => void;
  onNext: () => void;
  isLast: boolean;
  step: StepKey;
  evaluating?: boolean;
  blockedReason?: string;
}) {
  const nextLabel = evaluating
    ? "Reading your words..."
    : step === "story"
      ? "See your Ceremony"
      : isLast
        ? "Done"
        : "Continue";
  return (
    <nav
      aria-label="Ceremony steps"
      className="animate-fade-in sticky bottom-4 mt-9 flex items-center justify-between gap-2.5 rounded-full border-[1.5px] border-ink/15 bg-cream p-2"
    >
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-secondary transition hover:bg-primary-soft"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      {blockedReason && (
        <span
          id="next-blocked-reason"
          role="status"
          className="flex-1 text-right text-xs font-semibold text-secondary"
        >
          {blockedReason}
        </span>
      )}
      {!isLast ? (
        <button
          onClick={() => canAdvance && onNext()}
          aria-disabled={!canAdvance}
          aria-describedby={blockedReason ? "next-blocked-reason" : undefined}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-[26px] py-3.5 text-sm font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-90"
          style={{ opacity: canAdvance ? 1 : 0.4, cursor: canAdvance ? "pointer" : "not-allowed" }}
        >
          {evaluating && <Loader2 className="h-4 w-4 animate-spin" />}
          {nextLabel}
          {!evaluating && <ChevronRight className="h-4 w-4" />}
        </button>
      ) : (
        <span className="rounded-full bg-primary-soft px-5 py-2.5 text-sm font-semibold text-secondary">
          Welcome to the river.
        </span>
      )}
    </nav>
  );
}
