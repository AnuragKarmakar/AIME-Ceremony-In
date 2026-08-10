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

// Fetches editable Visa Path copy (name/tagline/description/order) from the
// Wagtail CMS. Icon and color stay hardcoded in the frontend — see PATHS in
// routes/index.tsx — since those are presentation, not editable content.
//
// Returns null whenever the CMS isn't configured or can't be reached, so the
// caller can fall back to the hardcoded PATHS array and the app keeps
// working even if Wagtail is down, unset, or mid-migration.
export const fetchVisaPaths = createServerFn({ method: "GET" }).handler(
  async (): Promise<VisaPathContent[] | null> => {
    const base = process.env.WAGTAIL_API_URL;
    if (!base) return null;

    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/api/v2/visapaths/`);
      if (!res.ok) {
        console.error(`Wagtail visapaths request failed: ${res.status}`);
        return null;
      }
      const json = (await res.json()) as { items?: unknown[] };
      const parsed = z.array(VisaPathContentSchema).safeParse(json.items ?? []);
      if (!parsed.success) {
        console.error("Wagtail visapaths response did not match expected shape:", parsed.error);
        return null;
      }
      return parsed.data;
    } catch (e) {
      console.error("Failed to fetch Visa Path content from Wagtail:", e);
      return null;
    }
  },
);
