import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { evaluateStory, type EvaluationResult } from "@/lib/evaluate.functions";
import {
  fetchAgreements,
  fetchVisaPaths,
  type AgreementContent,
  type VisaPathContent,
} from "@/lib/wagtail.functions";
import { LanguageCombobox } from "@/components/LanguageCombobox";
import { QuizScreen } from "@/components/QuizScreen";
import { AgreementsScreen } from "@/components/AgreementsScreen";
import { DEFAULT_QUIZ_ANSWERS } from "@/lib/quiz.data";
import {
  Sparkles,
  Ticket,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Building2,
  Crown,
  GraduationCap,
  Waves,
  Flame,
  Check,
  Lock,
  CircleDot,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";


export const Route = createFileRoute("/")({
  component: CeremonyIn,
});

type StepKey =
  | "welcome"
  | "path"
  | "identity"
  | "story"
  | "result"
  | "quiz"
  | "agreements"
  | "journey";

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

type PathId =
  | "joy-corp"
  | "presidents"
  | "schools"
  | "systems"
  | "iksl";

const PATHS: {
  id: PathId;
  name: string;
  tagline: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  hue: string;
}[] = [
  {
    id: "joy-corp",
    name: "Joy Corp",
    tagline: "For organisations rewriting how business feels",
    description: "Companies redesigning around relational value, mentoring and joy.",
    Icon: Building2,
    hue: "from-[oklch(0.78_0.16_55)] to-[oklch(0.63_0.17_32)]",
  },
  {
    id: "presidents",
    name: "IMAGI-NATION Presidents",
    tagline: "For young leaders imagining new nations",
    description: "Young people age 13 to 18 leading unreasonable, world changing projects.",
    Icon: Crown,
    hue: "from-[oklch(0.82_0.15_90)] to-[oklch(0.66_0.19_45)]",
  },
  {
    id: "schools",
    name: "IMAGI-NATION Schools",
    tagline: "For classrooms that mentor forward",
    description: "Schools weaving imagination and mentoring into how learning happens.",
    Icon: GraduationCap,
    hue: "from-[oklch(0.7_0.12_180)] to-[oklch(0.42_0.08_200)]",
  },
  {
    id: "systems",
    name: "Systems Change Citizens",
    tagline: "For everyday change makers",
    description: "Citizens learning to shift the systems around them through mentoring.",
    Icon: Waves,
    hue: "from-[oklch(0.55_0.12_220)] to-[oklch(0.38_0.09_205)]",
  },
  {
    id: "iksl",
    name: "Indigenous Knowledge Systems Labs",
    tagline: "For custodians of ancient future thinking",
    description: "Labs centering Indigenous knowledge as design for the next 100 years.",
    Icon: Flame,
    hue: "from-[oklch(0.6_0.18_25)] to-[oklch(0.35_0.08_30)]",
  },
];

// Overlays editable copy (name/tagline/description/order) fetched from
// Wagtail onto the hardcoded PATHS. Icon and hue always come from PATHS —
// they're presentation, not CMS content. Falls back to PATHS untouched
// whenever the CMS is unset, unreachable, or hasn't returned a given path
// yet, so the app never shows a broken or empty Visa Path screen.
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
  if (step === "path") canAdvance = form.path !== null;
  else if (step === "identity")
    canAdvance = Boolean(
      form.firstName.trim() &&
      form.lastName.trim() &&
      /\S+@\S+\.\S+/.test(form.email) &&
      form.motherTongue.trim() &&
      form.city.trim() &&
      form.country.trim(),
    );
  else if (step === "story")
    canAdvance =
      form.story.trim().length >= 10 &&
      form.beings.every((b) => b.name.trim().length > 0) &&
      !evaluating;
  else if (step === "result") canAdvance = evaluation?.canProceed !== false;

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

  const next = async () => {
    setDirection("forward");
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
        goTo("result");
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
  };
  const back = () => {
    setDirection("back");
    setStepIdx((i) => Math.max(i - 1, 0));
  };

  // The identity badge (name + Visa Path) appears in the header once the
  // applicant has moved past the "Who you are" step, replacing the small
  // card that used to sit above the reflection input.
  const identityIdx = STEPS.findIndex((s) => s.key === "identity");
  const showIdentityBadge = stepIdx > identityIdx;
  const fullName = `${form.firstName} ${form.lastName}`.trim();
  const pathName = paths.find((p) => p.id === form.path)?.name ?? null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 py-8 sm:py-12">
      <Header
        onHome={() => goTo("welcome")}
        name={showIdentityBadge ? fullName : null}
        pathName={showIdentityBadge ? pathName : null}
      />
      <ProgressIndicator current={stepIdx} />

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
            <PathScreen paths={paths} selected={form.path} onSelect={(p) => setField("path", p)} />
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
          {step === "result" && <ResultScreen paths={paths} form={form} evaluation={evaluation} />}
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
        />
      )}
    </main>
  );
}

function Header({
  onHome,
  name,
  pathName,
}: {
  onHome: () => void;
  name?: string | null;
  pathName?: string | null;
}) {
  const hasBadge = Boolean(name || pathName);
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onHome}
        aria-label="Return to start"
        className="group flex shrink-0 items-center gap-2 rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="grid h-9 w-9 place-items-center rounded-full bg-sunrise text-primary-foreground shadow-warm transition group-hover:brightness-110">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="text-left leading-tight">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary">
            AIME IMAGI-NATION
          </div>
          <div className="font-display text-lg text-foreground group-hover:underline">
            Ceremony-In
          </div>
        </div>
      </button>
      {hasBadge ? (
        <div className="animate-fade-in min-w-0 rounded-2xl border border-border bg-muted/40 px-4 py-2 text-right">
          {name && <div className="truncate font-display text-sm text-foreground">{name}</div>}
          {pathName && (
            <div className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">
              {pathName}
            </div>
          )}
        </div>
      ) : (
        <div className="hidden text-xs text-muted-foreground sm:block">
          A warm welcome, not a form.
        </div>
      )}
    </div>
  );
}

function ProgressIndicator({ current }: { current: number }) {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-1.5">
        {STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div key={s.key} className="flex flex-1 items-center gap-1.5">
              <div
                className={[
                  "h-1.5 flex-1 rounded-full transition-colors duration-500 ease-out",
                  done ? "bg-primary" : active ? "bg-sunrise" : "bg-muted",
                ].join(" ")}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <span>
          Step {current + 1} of {STEPS.length}
        </span>
        <span className="text-secondary">{STEPS[current].label}</span>
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
    <div className="ceremony-card mx-auto max-w-2xl p-8 sm:p-12">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        You are welcome here
      </div>
      <h1 className="mt-5 font-display text-4xl leading-[1.05] sm:text-5xl">
        Step into the <span className="gradient-text-sunrise">Ceremony-In</span>.
      </h1>
      <p className="mt-4 max-w-lg text-base text-muted-foreground">
        This is where you meet the movement. A few gentle questions, a story you bring with you, and
        a path chosen with care. No forms that feel like forms.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          onClick={onBegin}
          className="group inline-flex items-center justify-center gap-2 rounded-full bg-sunrise px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-warm transition hover:brightness-105 active:scale-[0.98]"
        >
          Begin Ceremony-In
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium text-secondary hover:bg-secondary-soft"
        >
          <Ticket className="h-4 w-4 text-gold" />
          I have a Golden Ticket
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="animate-fade-in mt-5 gold-ring rounded-2xl bg-card p-4 sm:p-5">
          <label className="text-xs font-semibold uppercase tracking-wider text-accent-foreground">
            Golden Ticket or referral code
          </label>
          <div className="mt-2 flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Ticket className="h-4 w-4" />
            </div>
            <input
              value={golden}
              onChange={(e) => setGolden(e.target.value)}
              placeholder="e.g. RIVER-SUNRISE-2026"
              className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-0 focus:border-primary"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Optional. A Golden Ticket unlocks mentor invitations and unlocks early stages on the
            River Run.
          </p>
        </div>
      )}

      <div className="mt-10 grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
        {["Mentoring", "Imagination", "Custodianship"].map((w) => (
          <div key={w} className="rounded-xl border border-border bg-muted/40 px-3 py-2">
            {w}
          </div>
        ))}
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
  return (
    <div>
      <SectionHeader
        eyebrow="Choose a Visa Path"
        title="Which doorway feels most like yours?"
        subtitle="Pick the one that fits today. You can carry more than one over time."
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {paths.map(({ id, name, tagline, description, Icon, hue }) => {
          const active = selected === id;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={[
                "group relative overflow-hidden rounded-2xl border p-5 text-left transition",
                active
                  ? "border-primary bg-card shadow-warm"
                  : "border-border bg-card hover:-translate-y-0.5 hover:shadow-warm",
              ].join(" ")}
            >
              <div
                className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${hue} text-primary-foreground`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="font-display text-lg">{name}</div>
              <div className="mt-0.5 text-xs font-medium text-secondary">{tagline}</div>
              <p className="mt-3 text-sm text-muted-foreground">{description}</p>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Visa Path</span>
                <span
                  className={[
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {active ? (
                    <>
                      <Check className="h-3 w-3" /> Chosen
                    </>
                  ) : (
                    "Select"
                  )}
                </span>
              </div>
            </button>
          );
        })}
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
    <div className="ceremony-card mx-auto max-w-2xl p-7 sm:p-10">
      <SectionHeader
        eyebrow="A few gentle details"
        title="Tell us who is arriving."
        subtitle="Just the basics. Your story comes next."
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="First name" required>
          <input
            value={form.firstName}
            onChange={(e) => setField("firstName", e.target.value)}
            placeholder="Ada"
            className={inputCx}
          />
        </Field>
        <Field label="Last name" required>
          <input
            value={form.lastName}
            onChange={(e) => setField("lastName", e.target.value)}
            placeholder="Aroha"
            className={inputCx}
          />
        </Field>
        <Field label="Email" required>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            placeholder="you@village.earth"
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
            className={inputCx}
          />
        </Field>
        <Field label="Country" required>
          <input
            value={form.country}
            onChange={(e) => setField("country", e.target.value)}
            placeholder="Australia"
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
    <div className="ceremony-card mx-auto max-w-2xl p-7 sm:p-10">
      <SectionHeader
        eyebrow="Your reflection"
        title="What brought you to the river?"
        subtitle="A paragraph is plenty. Write like you are talking to a mentor."
      />

      <div className="mt-6">
        <textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={8}
          placeholder="I keep noticing that..."
          disabled={evaluating}
          className="min-h-[180px] w-full resize-y rounded-2xl border border-input bg-background p-4 text-base leading-relaxed outline-none focus:border-primary disabled:opacity-60"
        />
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Written from the heart, not for the algorithm.</span>
          <span>{story.trim().length} characters</span>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-primary-soft/40 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">
                A relational welcome
              </div>
              <h3 className="mt-1 font-display text-2xl leading-snug">
                Name four beings you bring with you.
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Not yourself. Four others whose presence walks beside you into Imagination. They can
                be from your past, present, or future, real or imagined, human or more than human. A
                river, an ancestor, a child not yet born, a book that raised you, a dog, a mountain,
                a mentor.
              </p>
            </div>
            <div
              className={[
                "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                namedCount === 4
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {namedCount} of 4
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {beings.map((b, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sunrise text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </div>
                  <input
                    value={b.name}
                    onChange={(e) => setBeing(i, { name: e.target.value })}
                    placeholder={BEING_PLACEHOLDERS[i]}
                    disabled={evaluating}
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
                  />
                </div>
                <input
                  value={b.note}
                  onChange={(e) => setBeing(i, { note: e.target.value })}
                  placeholder="Why they walk with you"
                  disabled={evaluating}
                  className="mt-2 w-full rounded-lg border border-transparent bg-transparent px-3 py-1.5 text-xs text-muted-foreground outline-none focus:border-input focus:bg-background focus:text-foreground disabled:opacity-60"
                />
              </div>
            ))}
          </div>
        </div>

        {evaluating && (
          <div className="animate-fade-in mt-4 inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-2 text-sm text-primary">
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
          badgeCx: "bg-success/20 text-success",
          title: (
            <>
              Welcome, <span className="gradient-text-sunrise">{first}</span>.
              <br />
              The river makes room for you.
            </>
          ),
          body:
            evaluation?.reason ??
            "Your Ceremony-In is complete. A mentor will meet you at the first bend of the River Run.",
          ring: "border-primary/30",
        }
      : verdict === "yellow"
      ? {
          Icon: ShieldQuestion,
          badge: "Held with care",
          badgeCx: "bg-gold/20 text-accent-foreground gold-ring",
          title: (
            <>
              Thank you, <span className="gradient-text-sunrise">{first}</span>.
              <br />
              A human wants to meet you first.
            </>
          ),
          body:
            evaluation?.reason ??
            "Your reflection is thoughtful, and a mentor will read it with their own eyes before you continue down the river.",
          ring: "border-gold/40",
        }
      : verdict === "red_flag"
      ? {
          Icon: ShieldAlert,
          badge: "Flagged for review",
          badgeCx: "bg-destructive/15 text-destructive",
          title: (
            <>
              Thank you, <span className="gradient-text-sunrise">{first}</span>.
              <br />
              Your reflection has been flagged for review.
            </>
          ),
          body:
            evaluation?.reason ??
            "You wrote something, and you can continue down the river. An admin will read your reflection because it did not fully meet the ceremony criteria.",
          ring: "border-gold/50",
        }
      : {
          Icon: ShieldAlert,
          badge: "Please try again",
          badgeCx: "bg-destructive/15 text-destructive",
          title: (
            <>
              Thank you for arriving, <span className="text-destructive">{first}</span>.
              <br />
              Your reflection is not ready yet.
            </>
          ),
          body:
            evaluation?.reason ??
            "Your reflection did not show meaningful engagement with this ceremony. Please go back and share a few honest sentences before continuing.",
          ring: "border-destructive/40",
        };

  const Icon = theme.Icon;

  return (
    <div className={`ceremony-card mx-auto max-w-2xl overflow-hidden border p-8 sm:p-12 ${theme.ring}`}>
      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${theme.badgeCx}`}>
        <Icon className="h-3.5 w-3.5" />
        {theme.badge}
      </div>
      <h2 className="mt-5 font-display text-4xl leading-[1.05] sm:text-5xl">
        {theme.title}
      </h2>
      {evaluation?.headline && (
        <p className="mt-4 font-display text-xl text-secondary">
          {evaluation.headline}
        </p>
      )}
      <p className="mt-3 max-w-lg text-base text-muted-foreground">
        {theme.body}
      </p>

      {verdict !== "red_block" && (
        <div className="mt-8 flex flex-wrap gap-2">
          <Tag>Path: {path?.name ?? "Chosen with care"}</Tag>
          {form.motherTongue && <Tag>Speaks: {form.motherTongue}</Tag>}
          {(form.city || form.country) && (
            <Tag>
              From: {[form.city, form.country].filter(Boolean).join(", ")}
            </Tag>
          )}
          {form.goldenTicket && <Tag gold>Golden Ticket honoured</Tag>}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-secondary hover:underline"
      >
        {open ? "Hide details" : "View details"}
        <ChevronDown
          className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="animate-fade-in mt-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
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
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Four beings you brought
            </div>
            <ul className="mt-1 space-y-1">
              {form.beings.map((b, i) => (
                <li key={i} className="text-foreground">
                  {i + 1}. {b.name || <span className="text-muted-foreground">(unnamed)</span>}
                  {b.note && (
                    <span className="text-muted-foreground">: {b.note}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Your reflection
            </div>
            <p className="mt-1 whitespace-pre-wrap text-foreground">
              {form.story}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


/* ------------------------- 5. Journey ------------------------- */

function JourneyScreen({ form }: { form: FormState }) {
  const hasGolden = !!form.goldenTicket.trim();
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

  return (
    <div>
      <SectionHeader
        eyebrow="River Run"
        title="Your next steps down the river."
        subtitle="A gamified mentoring pathway. Move at the pace of trust."
      />
      <ol className="mx-auto mt-8 max-w-2xl">
        {stages.map((s, i) => (
          <li key={s.title} className="relative pl-14 pb-6 last:pb-0">
            {i < stages.length - 1 && (
              <span
                aria-hidden
                className={[
                  "absolute left-[22px] top-11 h-[calc(100%-1.5rem)] w-0.5",
                  s.state === "done"
                    ? "bg-primary"
                    : s.state === "unlocked"
                    ? "bg-gradient-to-b from-primary to-border"
                    : "bg-border",
                ].join(" ")}
              />
            )}
            <StageDot state={s.state} />
            <div
              className={[
                "rounded-2xl border p-4 sm:p-5",
                s.state === "done"
                  ? "border-primary/40 bg-primary-soft/60"
                  : s.state === "unlocked"
                  ? "border-accent bg-card gold-ring"
                  : "border-border bg-card/60",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-display text-lg">{s.title}</div>
                <StageBadge state={s.state} />
              </div>
              <p
                className={[
                  "mt-1 text-sm",
                  s.state === "locked" ? "text-muted-foreground" : "text-foreground/80",
                ].join(" ")}
              >
                {s.note}
              </p>
              {s.state === "unlocked" && (
                <button className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sunrise px-4 py-2 text-sm font-semibold text-primary-foreground shadow-warm">
                  Begin this stage
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StageDot({ state }: { state: "done" | "unlocked" | "locked" }) {
  const base =
    "absolute left-0 top-3 grid h-11 w-11 place-items-center rounded-full border";
  if (state === "done")
    return (
      <div className={`${base} border-primary bg-primary text-primary-foreground`}>
        <Check className="h-5 w-5" />
      </div>
    );
  if (state === "unlocked")
    return (
      <div className={`${base} border-accent bg-accent text-accent-foreground`}>
        <CircleDot className="h-5 w-5" />
      </div>
    );
  return (
    <div className={`${base} border-border bg-muted text-muted-foreground`}>
      <Lock className="h-4 w-4" />
    </div>
  );
}

function StageBadge({ state }: { state: "done" | "unlocked" | "locked" }) {
  const map = {
    done: { t: "Completed", c: "bg-primary text-primary-foreground" },
    unlocked: { t: "Unlocked", c: "bg-accent text-accent-foreground" },
    locked: { t: "Locked", c: "bg-muted text-muted-foreground" },
  } as const;
  const { t, c } = map[state];
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${c}`}>
      {t}
    </span>
  );
}

/* ------------------------- Shared bits ------------------------- */

const inputCx =
  "w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";

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
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-secondary">
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
    <div className="mx-auto max-w-2xl text-center sm:text-left">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
        {eyebrow}
      </div>
      <h2 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Tag({
  children,
  gold = false,
}: {
  children: React.ReactNode;
  gold?: boolean;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
        gold
          ? "bg-accent text-accent-foreground gold-ring"
          : "bg-secondary-soft text-secondary",
      ].join(" ")}
    >
      {gold && <Ticket className="h-3 w-3" />}
      {children}
    </span>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {k}
      </dt>
      <dd className="text-sm text-foreground">{v || "not shared"}</dd>
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
}: {
  canAdvance: boolean;
  onBack: () => void;
  onNext: () => void;
  isLast: boolean;
  step: StepKey;
  evaluating?: boolean;
}) {
  const nextLabel = evaluating
    ? "Reading your words..."
    : step === "story"
    ? "See your Ceremony"
    : isLast
    ? "Done"
    : "Continue";
  return (
    <div className="animate-fade-in sticky bottom-4 mt-10 flex items-center justify-between gap-3 rounded-full border border-border bg-card/90 px-3 py-2 backdrop-blur transition-all duration-300">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-secondary hover:bg-secondary-soft"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      {!isLast ? (
        <button
          onClick={onNext}
          disabled={!canAdvance}
          className="inline-flex items-center gap-1.5 rounded-full bg-sunrise px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-warm transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {evaluating && <Loader2 className="h-4 w-4 animate-spin" />}
          {nextLabel}
          {!evaluating && <ChevronRight className="h-4 w-4" />}
        </button>
      ) : (
        <span className="rounded-full bg-primary-soft px-4 py-2 text-sm font-medium text-primary">
          Welcome to the river.
        </span>
      )}
    </div>
  );
}
