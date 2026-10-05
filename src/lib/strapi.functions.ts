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
// section. `id` is Strapi's own component-row id, used both as a React key
// and as the key under which acceptance is tracked in FormState.agreementsAccepted.
const AgreementStatementSchema = z.object({
  id: z.number(),
  text: z.string(),
});

export type AgreementStatement = z.infer<typeof AgreementStatementSchema>;

// Strapi v5 returns fields flat (no `.attributes` wrapper) and already in
// camelCase, since the content-type schema itself is defined in camelCase.
const AgreementContentSchema = z.object({
  slug: z.string(),
  headerTitle: z.string(),
  headerDescription: z.string(),
  instructionalTitle: z.string(),
  bodyTitle: z.string(),
  bodyDescription: z.string(),
  submissionInstructionTitle: z.string(),
  submissionTitle: z.string(),
  submissionDescription: z.string(),
  statements: z.array(AgreementStatementSchema),
  order: z.number(),
});

export type AgreementContent = z.infer<typeof AgreementContentSchema>;

// Generic helper: GET a Strapi REST API listing endpoint and validate its
// `data` array against the given schema. Returns null whenever the CMS
// isn't configured or can't be reached, so callers can fall back to
// hardcoded content and the app keeps working even if Strapi is down,
// unset, or mid-migration.
async function fetchStrapiListing<S extends z.ZodTypeAny>(
  endpoint: string,
  schema: S,
): Promise<z.infer<S>[] | null> {
  const base = process.env.STRAPI_API_URL;
  if (!base) return null;

  try {
    const headers: Record<string, string> = {};
    if (process.env.STRAPI_API_TOKEN) {
      headers.Authorization = `Bearer ${process.env.STRAPI_API_TOKEN}`;
    }
    const res = await fetch(`${base.replace(/\/$/, "")}/api/${endpoint}`, { headers });
    if (!res.ok) {
      console.error(`Strapi ${endpoint} request failed: ${res.status}`);
      return null;
    }
    const json = (await res.json()) as { data?: unknown[] };
    const parsed = z.array(schema).safeParse(json.data ?? []);
    if (!parsed.success) {
      console.error(`Strapi ${endpoint} response did not match expected shape:`, parsed.error);
      return null;
    }
    return parsed.data;
  } catch (e) {
    console.error(`Failed to fetch ${endpoint} from Strapi:`, e);
    return null;
  }
}

// Fetches editable Visa Path copy (name/tagline/description/order) from the
// Strapi CMS. Icon and color stay hardcoded in the frontend — see PATHS in
// routes/index.tsx — since those are presentation, not editable content.
export const fetchVisaPaths = createServerFn({ method: "GET" }).handler(() =>
  fetchStrapiListing("visa-paths?sort=order&pagination[pageSize]=100", VisaPathContentSchema),
);

// Fetches the agreement pages shown after the quiz, before River Run.
export const fetchAgreements = createServerFn({ method: "GET" }).handler(() =>
  fetchStrapiListing(
    "agreements?populate=statements&sort=order&pagination[pageSize]=100",
    AgreementContentSchema,
  ),
);
