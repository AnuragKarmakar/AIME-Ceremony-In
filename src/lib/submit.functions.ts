import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkGoldenTicket } from "./golden-ticket.server";
import { buildAgreementRecords, type AgreementRecord } from "./agreements-consent.server";

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

/** Generous ceilings for the Agreements step (3 agreements, 16 statements today). */
const MAX_AGREEMENTS = 20;
const MAX_STATEMENTS = 200;

/** The wizard asks 61 questions; the ceiling leaves room for growth. */
const MAX_QUIZ_ANSWERS = 200;

/** Matches the frontend wizard's own deliberately loose email pattern. */
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const BeingSchema = z.object({
  name: z.string().trim().min(1, "Being name is required.").max(MAX_SHORT_TEXT_LENGTH),
  note: z.string().max(MAX_NOTE_LENGTH).optional().default(""),
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
  quizAnswers: z
    .record(z.string(), z.number().min(0).max(5))
    .refine((answers) => Object.keys(answers).length <= MAX_QUIZ_ANSWERS, {
      message: `At most ${MAX_QUIZ_ANSWERS} quiz answers are allowed.`,
    })
    .optional(),
  /**
   * What the applicant accepted on the Agreements step, as shown to them.
   * Omitted when they never reached it (e.g. blocked at the verdict). The
   * server re-checks this against the live CMS before storing it.
   */
  agreements: z
    .array(
      z.object({
        slug: z.string().max(MAX_SHORT_TEXT_LENGTH),
        revisionId: z.number().int().nullable(),
        acceptedStatementIds: z.array(z.number().int()).max(MAX_STATEMENTS),
      }),
    )
    .max(MAX_AGREEMENTS)
    .optional(),
  evaluation: z
    .object({
      verdict: z.enum(VALID_VERDICTS).optional().or(z.literal("")),
      headline: z.string().max(MAX_SHORT_TEXT_LENGTH).optional(),
      reason: z.string().max(MAX_REASON_LENGTH).optional(),
      canProceed: z.boolean(),
      adminReview: z.boolean(),
    })
    .optional(),
});

export type SubmitResult = { id: string };

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

/**
 * Flattens a ceremony submission into Airtable's `fields` object. This is the
 * ONLY place that knows Airtable column names — schema changes should touch
 * nothing else. Ported 1:1 from the retired .NET middleware's AirtableRecordMapper.
 */
function toAirtableFields(
  data: SubmissionInput,
  submittedAt: Date,
  goldenTicketVerified: boolean,
  agreementRecords: AgreementRecord[] | null,
): Record<string, unknown> {
  const firstName = clean(data.firstName);
  const lastName = clean(data.lastName);
  const pathId = clean(data.path);

  const fields: Record<string, unknown> = {
    // `Name` is the table's primary field — holding the full name keeps
    // records identifiable in the Airtable grid and in linked records.
    Name: [firstName, lastName].filter((n) => n.length > 0).join(" "),
    "First Name": firstName,
    "Last Name": lastName,
    Email: clean(data.email),
    "Mother Tongue": clean(data.motherTongue),
    City: clean(data.city),
    Country: clean(data.country),
    Story: clean(data.story),
    "Path Id": pathId,
    Path: PATH_LABELS[pathId] ?? pathId,
    "Golden Ticket": clean(data.goldenTicket),
    // The number as typed is kept for reference; this flag is only true when it
    // was verified against the Tickets table for this applicant's name.
    "Has Golden Ticket": goldenTicketVerified,
    "Submitted At": submittedAt.toISOString(),
  };

  // Beings get one column pair each so they stay readable in the grid.
  for (let i = 0; i < REQUIRED_BEINGS; i++) {
    const being = data.beings[i];
    fields[`Being ${i + 1} Name`] = clean(being?.name);
    fields[`Being ${i + 1} Note`] = clean(being?.note);
  }

  // All answers as one JSON blob: keeps the grid usable and means quiz edits
  // never require an Airtable schema migration.
  const answered = data.quizAnswers && Object.keys(data.quizAnswers).length > 0;
  fields["Quiz Completed"] = Boolean(answered);
  fields["Quiz Answers"] = answered
    ? JSON.stringify(
        // Ordered so records diff cleanly and are readable by eye.
        Object.fromEntries(Object.entries(data.quizAnswers!).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
      )
    : "";
  fields["Quiz Answer Count"] = data.quizAnswers ? Object.keys(data.quizAnswers).length : 0;

  fields["Agreements Accepted"] = agreementRecords ? JSON.stringify(agreementRecords) : "";

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

/**
 * Creates one record in Airtable and returns its record id.
 *
 * Deliberately retries 429 only. Record creation is not idempotent — Airtable
 * offers no request key — so replaying a POST that may have already been
 * applied would risk duplicate submissions. A 429 is safe because Airtable
 * rejects the request outright without applying it; a 5xx is ambiguous, so it
 * is surfaced instead of guessed at.
 */
async function createAirtableRecord(fields: Record<string, unknown>): Promise<string> {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE;

  if (!token || !baseId || !table) {
    throw new Error("Missing AIRTABLE_TOKEN, AIRTABLE_BASE_ID, or AIRTABLE_TABLE.");
  }

  const url = `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}`;

  // typecast lets Airtable coerce strings into select options it hasn't seen
  // yet, so a new visa path doesn't need a manual schema edit first.
  const payload = {
    records: [{ fields }],
    typecast: true,
  };

  let lastResponse: Response | null = null;
  let lastBody = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    lastResponse = res;
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

  if (!lastResponse!.ok) {
    const errorType = extractErrorType(lastBody);
    // Never log the body at error level without care — it echoes submitted
    // data. Field names and Airtable's error type are enough to diagnose.
    console.error(
      `Airtable rejected record creation for base ${baseId} table ${table}: ${lastResponse!.status} ${errorType ?? "(none)"}`,
    );
    throw new Error(`Airtable returned ${lastResponse!.status} (${errorType ?? "unknown error"}).`);
  }

  let recordId: string | undefined;
  try {
    const json = JSON.parse(lastBody) as { records?: { id?: string }[] };
    recordId = json.records?.[0]?.id;
  } catch {
    // fall through to the error below
  }

  if (!recordId) {
    throw new Error("Airtable returned success but no record id.");
  }

  return recordId;
}

export const submitCeremony = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<SubmitResult> => {
    const goldenTicketVerified =
      clean(data.goldenTicket).length > 0 &&
      (await checkGoldenTicket(data.goldenTicket, data.firstName, data.lastName)) === "valid";
    const agreementRecords = data.agreements?.length
      ? await buildAgreementRecords(data.agreements)
      : null;
    const fields = toAirtableFields(data, new Date(), goldenTicketVerified, agreementRecords);
    const id = await createAirtableRecord(fields);
    return { id };
  });
