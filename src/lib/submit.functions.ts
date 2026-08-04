import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BeingSchema = z.object({
  name: z.string(),
  note: z.string(),
});

const InputSchema = z.object({
  goldenTicket: z.string().optional(),
  path: z.string().nullable().optional(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  motherTongue: z.string(),
  city: z.string(),
  country: z.string(),
  story: z.string(),
  beings: z.array(BeingSchema),
  /**
   * Omitted entirely when the applicant never reached the quiz. The ceremony
   * verdict comes BEFORE the Relational Check-in, so a blocked applicant would
   * otherwise send 61 untouched default answers that look like real ones.
   */
  quizAnswers: z.record(z.string(), z.number()).optional(),
  evaluation: z
    .object({
      verdict: z.string(),
      headline: z.string(),
      reason: z.string(),
      canProceed: z.boolean(),
      adminReview: z.boolean(),
    })
    .optional(),
});

export type SubmitResult = { id: string };


export const submitCeremony = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<SubmitResult> => {
    const baseUrl = process.env.CEREMONY_API_URL ?? "http://localhost:5110";

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Submission storage failed with ${res.status}: ${text}`);
    }

    const json = (await res.json()) as Partial<SubmitResult>;
    if (!json.id) {
      throw new Error("Submission storage returned no record id.");
    }

    return { id: json.id };
  });
