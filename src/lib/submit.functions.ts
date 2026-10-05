import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { EvaluationResult } from "@/lib/evaluate.functions";

/** Visa path ids accepted by the wizard. */
const VALID_PATHS = ["joy-corp", "presidents", "schools", "systems", "iksl"] as const;

/** Verdicts the Gemini evaluator can return. */
const VALID_VERDICTS = ["green", "yellow", "red_flag", "red_block"] as const;

const MIN_STORY_LENGTH = 10;
const REQUIRED_BEINGS = 4;

// Upper bounds exist so unbounded input can't be relayed into Airtable, which
// charges by row and caps a long-text cell at 100k characters. These are well
// above anything the wizard's own inputs can produce.
const MAX_STORY_LENGTH = 5_000;
const MAX_SHORT_TEXT_LENGTH = 200;
const MAX_NOTE_LENGTH = 500;
const MAX_REASON_LENGTH = 2_000;
const MAX_STEP_KEY_LENGTH = 40;

/** The wizard asks 61 questions; the ceiling leaves room for growth. */
const MAX_QUIZ_ANSWERS = 200;
/** One entry per agreement statement across every agreement page. */
const MAX_AGREEMENT_ENTRIES = 100;

/** Matches the frontend wizard's own deliberately loose email pattern. */
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const BeingSchema = z.object({
  name: z.string().trim().min(1, "Being name is required.").max(MAX_SHORT_TEXT_LENGTH),
  note: z.string().max(MAX_NOTE_LENGTH).optional().default(""),
});

const EvaluationInputSchema = z.object({
  verdict: z.enum(VALID_VERDICTS).optional().or(z.literal("")),
  headline: z.string().max(MAX_SHORT_TEXT_LENGTH).optional(),
  reason: z.string().max(MAX_REASON_LENGTH).optional(),
  canProceed: z.boolean(),
  adminReview: z.boolean(),
});

const QuizAnswersSchema = z
  .record(z.string(), z.number().min(0).max(5))
  .refine((answers) => Object.keys(answers).length <= MAX_QUIZ_ANSWERS, {
    message: `At most ${MAX_QUIZ_ANSWERS} quiz answers are allowed.`,
  });

const AgreementsAcceptedSchema = z
  .record(z.string(), z.boolean())
  .refine((entries) => Object.keys(entries).length <= MAX_AGREEMENT_ENTRIES, {
    message: `At most ${MAX_AGREEMENT_ENTRIES} agreement statements are allowed.`,
  });

const InputSchema = z.object({
  goldenTicket: z.string().max(MAX_SHORT_TEXT_LENGTH).optional(),
  path: z.enum(VALID_PATHS),
  firstName: z.string().trim().min(1).max(MAX_SHORT_TEXT_LENGTH),
  lastName: z.string().trim().min(1).max(MAX_SHORT_TEXT_LENGTH),
  email: z.string().trim().max(MAX_SHORT_TEXT_LENGTH).regex(EMAIL_PATTERN, "Email is not a valid address."),
  motherTongue: z.string().trim().min(1).max(MAX_SHORT_TEXT_LENGTH),
  city: z.string().trim().min(1).max(MAX_SHORT_TEXT_LENGTH),
  country: z.string().trim().min(1).max(MAX_SHORT_TEXT_LENGTH),
  story: z.string().trim().min(MIN_STORY_LENGTH).max(MAX_STORY_LENGTH),
  beings: z.array(BeingSchema).length(REQUIRED_BEINGS),
  /**
   * Omitted entirely when the applicant never reached the quiz. The ceremony
   * verdict comes BEFORE the Relational Check-in, so a blocked applicant would
   * otherwise send 61 untouched default answers that look like real ones.
   */
  quizAnswers: QuizAnswersSchema.optional(),
  agreementsAccepted: AgreementsAcceptedSchema.optional(),
  evaluation: EvaluationInputSchema.optional(),
});

// Same shape as InputSchema but relaxed: a partial save can happen from any
// point after the Identity step, well before most fields are filled in or
// pass final validation. Email is the one thing that must already be a real
// address, since it is the key partial saves are looked up and merged by.
const SaveProgressInputSchema = z.object({
  stepKey: z.string().trim().min(1).max(MAX_STEP_KEY_LENGTH),
  goldenTicket: z.string().max(MAX_SHORT_TEXT_LENGTH).optional(),
  path: z.enum(VALID_PATHS).optional(),
  firstName: z.string().max(MAX_SHORT_TEXT_LENGTH).optional(),
  lastName: z.string().max(MAX_SHORT_TEXT_LENGTH).optional(),
  email: z.string().trim().max(MAX_SHORT_TEXT_LENGTH).regex(EMAIL_PATTERN, "Email is not a valid address."),
  motherTongue: z.string().max(MAX_SHORT_TEXT_LENGTH).optional(),
  city: z.string().max(MAX_SHORT_TEXT_LENGTH).optional(),
  country: z.string().max(MAX_SHORT_TEXT_LENGTH).optional(),
  story: z.string().max(MAX_STORY_LENGTH).optional(),
  beings: z
    .array(z.object({ name: z.string().max(MAX_SHORT_TEXT_LENGTH), note: z.string().max(MAX_NOTE_LENGTH) }))
    .max(REQUIRED_BEINGS)
    .optional(),
  quizAnswers: QuizAnswersSchema.optional(),
  agreementsAccepted: AgreementsAcceptedSchema.optional(),
  evaluation: EvaluationInputSchema.optional(),
});

const FetchProgressInputSchema = z.object({
  email: z.string().trim().max(MAX_SHORT_TEXT_LENGTH).regex(EMAIL_PATTERN, "Email is not a valid address."),
});

export type SubmitResult = { id: string };
export type SaveProgressResult = { id: string };

// What a resumed session hands back to the frontend — deliberately NOT the
// raw Airtable fields, so this file stays the only place that knows Airtable
// column names. `path` is typed as `string | null` rather than the
// frontend's own PathId union to avoid a lib -> route type dependency; it is
// always one of VALID_PATHS when present, since that is all saveProgress
// ever accepted.
export type SavedRemoteProgress = {
  stepKey: string;
  form: {
    goldenTicket: string;
    path: string | null;
    firstName: string;
    lastName: string;
    email: string;
    motherTongue: string;
    city: string;
    country: string;
    story: string;
    beings: { name: string; note: string }[];
    quizAnswers: Record<string, number>;
    agreementsAccepted: Record<string, boolean>;
  };
  evaluation: EvaluationResult | null;
};

/** Human-readable labels for the five visa paths, as shown in the wizard. */
const PATH_LABELS: Record<string, string> = {
  "joy-corp": "Joy Corp",
  presidents: "IMAGI-NATION Presidents",
  schools: "IMAGI-NATION Schools",
  systems: "Systems Change Citizens",
  iksl: "Indigenous Knowledge Systems Labs",
};

const clean = (value: string | null | undefined) => value?.trim() ?? "";

type SubmissionInput = z.infer<typeof InputSchema>;
type SaveProgressInput = z.infer<typeof SaveProgressInputSchema>;

function sortedJson(record: Record<string, unknown>): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
  );
}

/**
 * Flattens either a final submission or an in-progress save into Airtable's
 * `fields` object. This is the ONLY place that knows Airtable column names —
 * schema changes should touch nothing else. Ported 1:1 (for the final-submit
 * fields) from the retired .NET middleware's AirtableRecordMapper, extended
 * with Status/Last Step/Agreements Accepted for save-and-resume.
 */
function toAirtableFields(
  data: SubmissionInput | SaveProgressInput,
  status: "Incomplete" | "Submitted",
  submittedAt: Date,
): Record<string, unknown> {
  const firstName = clean(data.firstName);
  const lastName = clean(data.lastName);
  const pathId = clean(data.path);

  const fields: Record<string, unknown> = {
    // `Name` is the table's primary field — holding the full name keeps
    // records identifiable in the Airtable grid and in linked records.
    Name: [firstName, lastName].filter((n) => n.length > 0).join(" ") || clean(data.email),
    "First Name": firstName,
    "Last Name": lastName,
    Email: clean(data.email),
    "Mother Tongue": clean(data.motherTongue),
    City: clean(data.city),
    Country: clean(data.country),
    Story: clean(data.story),
    "Path Id": pathId,
    Path: pathId ? (PATH_LABELS[pathId] ?? pathId) : "",
    "Golden Ticket": clean(data.goldenTicket),
    "Has Golden Ticket": clean(data.goldenTicket).length > 0,
    Status: status,
  };

  if (status === "Submitted") {
    fields["Submitted At"] = submittedAt.toISOString();
  }
  if ("stepKey" in data) {
    fields["Last Step"] = data.stepKey;
  }

  // Beings get one column pair each so they stay readable in the grid.
  for (let i = 0; i < REQUIRED_BEINGS; i++) {
    const being = data.beings?.[i];
    fields[`Being ${i + 1} Name`] = clean(being?.name);
    fields[`Being ${i + 1} Note`] = clean(being?.note);
  }

  // All answers as one JSON blob: keeps the grid usable and means quiz edits
  // never require an Airtable schema migration.
  const answered = data.quizAnswers && Object.keys(data.quizAnswers).length > 0;
  fields["Quiz Completed"] = Boolean(answered);
  fields["Quiz Answers"] = answered ? sortedJson(data.quizAnswers!) : "";
  fields["Quiz Answer Count"] = data.quizAnswers ? Object.keys(data.quizAnswers).length : 0;

  fields["Agreements Accepted"] =
    data.agreementsAccepted && Object.keys(data.agreementsAccepted).length > 0
      ? sortedJson(data.agreementsAccepted)
      : "";

  const evaluation = data.evaluation;
  fields.Verdict = clean(evaluation?.verdict);
  fields.Headline = clean(evaluation?.headline);
  fields.Reason = clean(evaluation?.reason);
  fields["Can Proceed"] = evaluation?.canProceed ?? false;
  fields["Admin Review"] = evaluation?.adminReview ?? false;

  return fields;
}

/** Airtable's documented cool-off after a rate-limit trip. */
const RETRY_BASE_DELAY_MS = 1_000;
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function extractErrorType(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error?: string | { type?: string } };
    if (typeof parsed.error === "string") return parsed.error;
    if (parsed.error && typeof parsed.error === "object") return parsed.error.type ?? null;
  } catch {
    // Airtable can return non-JSON (e.g. an HTML gateway error page).
  }
  return null;
}

function getAirtableConfig(): { token: string; baseId: string; table: string } {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE;
  if (!token || !baseId || !table) {
    throw new Error("Missing AIRTABLE_TOKEN, AIRTABLE_BASE_ID, or AIRTABLE_TABLE.");
  }
  return { token, baseId, table };
}

/**
 * Sends one Airtable REST request, retrying only on 429. A 429 is safe to
 * retry because Airtable rejects the request outright without applying it;
 * a 5xx is ambiguous (the write may already have landed), so it is surfaced
 * instead of guessed at. This holds for PATCH just as much as POST: retrying
 * an update that already landed just re-applies the same field values.
 */
async function airtableRequest(
  method: "GET" | "POST" | "PATCH",
  url: string,
  body?: unknown,
): Promise<{ status: number; text: string }> {
  const { token } = getAirtableConfig();

  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    lastStatus = res.status;
    lastBody = await res.text();

    if (res.status !== 429 || attempt === MAX_ATTEMPTS) {
      break;
    }

    const retryAfterHeader = res.headers.get("Retry-After");
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
    const delay = Number.isFinite(retryAfterMs) ? retryAfterMs : RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);

    console.warn(`Airtable rate limited the request; retrying in ${delay}ms (attempt ${attempt}/${MAX_ATTEMPTS}).`);
    await sleep(delay);
  }

  return { status: lastStatus, text: lastBody };
}

/** Escapes a value for safe interpolation into an Airtable formula string literal. */
function formulaLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

type AirtableRecord = { id: string; fields: Record<string, unknown> };

/**
 * Looks up the most recent record for an email address, optionally
 * restricted to a Status. Returns null if none exists — never throws for a
 * clean "not found", only for an actual request failure.
 */
async function findRecordByEmail(
  email: string,
  status?: "Incomplete" | "Submitted",
): Promise<AirtableRecord | null> {
  const { baseId, table } = getAirtableConfig();
  const formula = status
    ? `AND(LOWER({Email})=LOWER('${formulaLiteral(email)}'), {Status}='${formulaLiteral(status)}')`
    : `LOWER({Email})=LOWER('${formulaLiteral(email)}')`;
  const url =
    `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}` +
    `?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1&sort[0][field]=Submitted At&sort[0][direction]=desc`;

  const { status: httpStatus, text } = await airtableRequest("GET", url);
  if (httpStatus !== 200) {
    const errorType = extractErrorType(text);
    console.error(`Airtable lookup by email failed: ${httpStatus} ${errorType ?? "(none)"}`);
    throw new Error(`Airtable returned ${httpStatus} (${errorType ?? "unknown error"}).`);
  }

  const json = JSON.parse(text) as { records?: AirtableRecord[] };
  return json.records?.[0] ?? null;
}

/**
 * Creates or updates one record in Airtable by email and returns its record
 * id. Used for both partial saves (Status=Incomplete) and final submission
 * (Status=Submitted) so a resumed-then-completed applicant ends up as one
 * row, not two.
 */
async function upsertAirtableRecord(
  email: string,
  fields: Record<string, unknown>,
): Promise<string> {
  const { baseId, table } = getAirtableConfig();
  const existing = await findRecordByEmail(email);

  if (existing) {
    const url = `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}/${existing.id}`;
    const { status, text } = await airtableRequest("PATCH", url, { fields, typecast: true });
    if (status < 200 || status >= 300) {
      const errorType = extractErrorType(text);
      console.error(`Airtable rejected record update for base ${baseId} table ${table}: ${status} ${errorType ?? "(none)"}`);
      throw new Error(`Airtable returned ${status} (${errorType ?? "unknown error"}).`);
    }
    return existing.id;
  }

  const url = `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}`;
  // typecast lets Airtable coerce strings into select options it hasn't seen
  // yet, so a new visa path or status value doesn't need a manual schema edit first.
  const { status, text } = await airtableRequest("POST", url, {
    records: [{ fields }],
    typecast: true,
  });
  if (status < 200 || status >= 300) {
    const errorType = extractErrorType(text);
    console.error(`Airtable rejected record creation for base ${baseId} table ${table}: ${status} ${errorType ?? "(none)"}`);
    throw new Error(`Airtable returned ${status} (${errorType ?? "unknown error"}).`);
  }

  const json = JSON.parse(text) as { records?: { id?: string }[] };
  const recordId = json.records?.[0]?.id;
  if (!recordId) {
    throw new Error("Airtable returned success but no record id.");
  }
  return recordId;
}

function parseJsonRecord(value: unknown): Record<string, never> | Record<string, unknown> {
  if (typeof value !== "string" || value.trim().length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function fieldsToSavedProgress(fields: Record<string, unknown>): SavedRemoteProgress {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const bool = (v: unknown) => v === true;
  const quizAnswersRaw = parseJsonRecord(fields["Quiz Answers"]);
  const quizAnswers: Record<string, number> = {};
  for (const [k, v] of Object.entries(quizAnswersRaw)) {
    if (typeof v === "number") quizAnswers[k] = v;
  }
  const agreementsRaw = parseJsonRecord(fields["Agreements Accepted"]);
  const agreementsAccepted: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(agreementsRaw)) {
    agreementsAccepted[k] = v === true;
  }

  const verdict = str(fields.Verdict);
  const evaluation: EvaluationResult | null = verdict
    ? {
        verdict: verdict as EvaluationResult["verdict"],
        headline: str(fields.Headline),
        reason: str(fields.Reason),
        canProceed: bool(fields["Can Proceed"]),
        adminReview: bool(fields["Admin Review"]),
      }
    : null;

  return {
    stepKey: str(fields["Last Step"]) || "identity",
    form: {
      goldenTicket: str(fields["Golden Ticket"]),
      path: str(fields["Path Id"]) || null,
      firstName: str(fields["First Name"]),
      lastName: str(fields["Last Name"]),
      email: str(fields.Email),
      motherTongue: str(fields["Mother Tongue"]),
      city: str(fields.City),
      country: str(fields.Country),
      story: str(fields.Story),
      beings: Array.from({ length: REQUIRED_BEINGS }, (_, i) => ({
        name: str(fields[`Being ${i + 1} Name`]),
        note: str(fields[`Being ${i + 1} Note`]),
      })),
      quizAnswers,
      agreementsAccepted,
    },
    evaluation,
  };
}

/**
 * Final submission — stores or finalizes one applicant. Upserts by email so
 * an applicant who was saved mid-flow (Status=Incomplete) ends up updated in
 * place rather than duplicated, and marks the record Status=Submitted.
 */
export const submitCeremony = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<SubmitResult> => {
    const fields = toAirtableFields(data, "Submitted", new Date());
    const id = await upsertAirtableRecord(data.email, fields);
    return { id };
  });

/**
 * Saves in-progress answers so an applicant can resume later, from any
 * browser, by re-entering their email. Deliberately lenient — most fields
 * are optional here since the applicant may be mid-way through any step.
 * Validation gates are enforced separately, at each step's own "continue"
 * button and at final submit; this endpoint only persists what has been
 * filled in so far.
 */
export const saveProgress = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SaveProgressInputSchema.parse(data))
  .handler(async ({ data }): Promise<SaveProgressResult> => {
    const fields = toAirtableFields(data, "Incomplete", new Date());
    const id = await upsertAirtableRecord(data.email, fields);
    return { id };
  });

/**
 * Looks up an in-progress (Status=Incomplete) record by email for the
 * "continue where you left off" flow. Returns null both when nothing was
 * found and when the matching record has already been submitted — a
 * finished ceremony is not reopened for editing.
 */
export const fetchProgressByEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => FetchProgressInputSchema.parse(data))
  .handler(async ({ data }): Promise<SavedRemoteProgress | null> => {
    const record = await findRecordByEmail(data.email, "Incomplete");
    if (!record) return null;
    return fieldsToSavedProgress(record.fields);
  });
