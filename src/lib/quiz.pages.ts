import { QUIZ_SECTIONS, type QuizQuestion, type QuizSection } from "./quiz.data";

/**
 * Presentation layer over QUIZ_SECTIONS: groups the 39 sections into 5
 * themes and splits them into pages of at most 4 questions, so no page
 * needs a long scroll. Question ids (and so the stored answers) are
 * unchanged; this only decides what shows together.
 *
 * Theme titles and blurbs are draft copy. Edit them here.
 */

/** No page ever shows more than this many questions. */
export const MAX_QUESTIONS_PER_PAGE = 4;

/** XP awarded for each completed page (shown as a toast, added to the header total). */
export const XP_PER_QUIZ_PAGE = 25;

export type QuizTheme = {
  key: string;
  title: string;
  blurb: string;
  /** QUIZ_SECTIONS keys, in order. */
  sectionKeys: string[];
};

export const QUIZ_THEMES: QuizTheme[] = [
  {
    key: "imagination",
    title: "Imagination",
    blurb: "How you dream, wonder and make room for what isn't here yet.",
    sectionKeys: [
      "imagination",
      "platypus",
      "emergence",
      "invitation",
      "big-talk",
      "inheritance",
      "potential",
    ],
  },
  {
    key: "relations",
    title: "Seven Elements of Relations",
    blurb: "How you connect with people, with nature and with knowledge.",
    sectionKeys: [
      "relations-1",
      "relations-2",
      "relations-3",
      "relations-4",
      "relations-5",
      "relations-6",
      "relations-7",
    ],
  },
  {
    key: "ways-of-being",
    title: "Ways of Being",
    blurb: "The values you carry with you down the river.",
    sectionKeys: [
      "imagi-nation",
      "death",
      "mentors-not-saviours",
      "hope",
      "change",
      "freedom",
      "rebellious",
      "listening",
      "empathy",
      "brave-goals",
      "no-shame",
      "initiative",
      "yes-and",
      "forgiveness",
      "kindness",
      "gift-of-time",
      "failure",
      "asking-questions",
      "effort",
      "know-yourself",
    ],
  },
  {
    key: "logic",
    title: "Logic",
    blurb: "How you reason when the water gets rough.",
    sectionKeys: ["logic"],
  },
  {
    key: "indigenous-systems",
    title: "Indigenous Systems Design",
    blurb: "Learning from the oldest continuous knowledge systems on Earth.",
    sectionKeys: ["systems-theory", "systems-application", "systems-knowledge", "relational-map"],
  },
];

/** One section's slice of questions on a page. `part` is set when a long section spans pages. */
export type QuizPageBlock = {
  section: QuizSection;
  questions: QuizQuestion[];
  part?: { index: number; of: number };
};

export type QuizPage = {
  themeIdx: number;
  blocks: QuizPageBlock[];
  questionCount: number;
};

/** Splits n questions into the fewest chunks of at most `max`, as evenly as possible (13 -> 4,3,3,3). */
function chunk<T>(items: T[], max: number): T[][] {
  const count = Math.ceil(items.length / max);
  const out: T[][] = [];
  let start = 0;
  for (let i = 0; i < count; i++) {
    const size = Math.ceil((items.length - start) / (count - i));
    out.push(items.slice(start, start + size));
    start += size;
  }
  return out;
}

function buildPages(): QuizPage[] {
  const byKey = new Map(QUIZ_SECTIONS.map((s) => [s.key, s]));
  const used = new Set<string>();
  const pages: QuizPage[] = [];

  QUIZ_THEMES.forEach((theme, themeIdx) => {
    let current: QuizPage | null = null;
    for (const key of theme.sectionKeys) {
      const section = byKey.get(key);
      if (!section) throw new Error(`Quiz theme "${theme.key}" lists unknown section "${key}".`);
      used.add(key);
      const parts = chunk(section.questions, MAX_QUESTIONS_PER_PAGE);
      parts.forEach((questions, index) => {
        const block: QuizPageBlock = {
          section,
          questions,
          ...(parts.length > 1 ? { part: { index: index + 1, of: parts.length } } : {}),
        };
        // Short sections share a page; a page never mixes themes or exceeds the cap.
        if (!current || current.questionCount + questions.length > MAX_QUESTIONS_PER_PAGE) {
          current = { themeIdx, blocks: [], questionCount: 0 };
          pages.push(current);
        }
        current.blocks.push(block);
        current.questionCount += questions.length;
      });
    }
  });

  const missing = QUIZ_SECTIONS.filter((s) => !used.has(s.key)).map((s) => s.key);
  if (missing.length)
    throw new Error(`Quiz sections not assigned to a theme: ${missing.join(", ")}`);
  return pages;
}

export const QUIZ_PAGES: QuizPage[] = buildPages();

/** Index of the last page of each theme. */
export const THEME_LAST_PAGE: number[] = QUIZ_THEMES.map((_, t) =>
  QUIZ_PAGES.reduce((last, p, i) => (p.themeIdx === t ? i : last), -1),
);
