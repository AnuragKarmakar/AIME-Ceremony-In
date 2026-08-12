import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const VisaPathContentSchema = z.object({
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  description: z.string(),
  order: z.number(),
});

export type VisaPathContent = z.infer<typeof VisaPathContentSchema>;

// One individually-checkable point within an agreement's submission
// section. `id` is a stable Wagtail row id, used both as a React key and as
// the key under which acceptance is tracked in FormState.agreementsAccepted.
const AgreementStatementSchema = z
  .object({
    id: z.number(),
    text: z.string(),
  })
  .transform((v) => ({ id: v.id, text: v.text }));

export type AgreementStatement = z.infer<typeof AgreementStatementSchema>;

// Wagtail/Django returns snake_case field names on the wire; transformed to
// camelCase for the TS side.
const AgreementContentSchema = z
  .object({
    slug: z.string(),
    header_title: z.string(),
    header_description: z.string(),
    instructional_title: z.string(),
    body_title: z.string(),
    body_description: z.string(),
    submission_instruction_title: z.string(),
    submission_title: z.string(),
    submission_description: z.string(),
    statements: z.array(AgreementStatementSchema),
    order: z.number(),
  })
  .transform((v) => ({
    slug: v.slug,
    headerTitle: v.header_title,
    headerDescription: v.header_description,
    instructionalTitle: v.instructional_title,
    bodyTitle: v.body_title,
    bodyDescription: v.body_description,
    submissionInstructionTitle: v.submission_instruction_title,
    submissionTitle: v.submission_title,
    submissionDescription: v.submission_description,
    statements: v.statements,
    order: v.order,
  }));

export type AgreementContent = z.infer<typeof AgreementContentSchema>;

// Generic helper: GET a Wagtail API v2 listing endpoint and validate its
// `items` against the given schema. Returns null whenever the CMS isn't
// configured or can't be reached, so callers can fall back to hardcoded
// content and the app keeps working even if Wagtail is down, unset, or
// mid-migration.
async function fetchWagtailListing<S extends z.ZodTypeAny>(
  endpoint: string,
  schema: S,
): Promise<z.infer<S>[] | null> {
  const base = process.env.WAGTAIL_API_URL;
  if (!base) return null;

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/v2/${endpoint}/`);
    if (!res.ok) {
      console.error(`Wagtail ${endpoint} request failed: ${res.status}`);
      return null;
    }
    const json = (await res.json()) as { items?: unknown[] };
    const parsed = z.array(schema).safeParse(json.items ?? []);
    if (!parsed.success) {
      console.error(`Wagtail ${endpoint} response did not match expected shape:`, parsed.error);
      return null;
    }
    return parsed.data;
  } catch (e) {
    console.error(`Failed to fetch ${endpoint} from Wagtail:`, e);
    return null;
  }
}

// Fetches editable Visa Path copy (name/tagline/description/order) from the
// Wagtail CMS. Icon and color stay hardcoded in the frontend — see PATHS in
// routes/index.tsx — since those are presentation, not editable content.
export const fetchVisaPaths = createServerFn({ method: "GET" }).handler(() =>
  fetchWagtailListing("visapaths", VisaPathContentSchema),
);

// Fetches the agreement pages shown after the quiz, before River Run.
export const fetchAgreements = createServerFn({ method: "GET" }).handler(() =>
  fetchWagtailListing("agreements", AgreementContentSchema),
);
