import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  story: z.string(),
  path: z.string().nullable().optional(),
  name: z.string().optional(),
  beings: z.array(z.string()).optional(),
  goldenTicket: z.string().optional(),
});

export type Verdict = "green" | "yellow" | "red_flag" | "red_block";

export type EvaluationResult = {
  verdict: Verdict;
  headline: string;
  reason: string;
  /** Whether the applicant is allowed to move forward in the flow. */
  canProceed: boolean;
  /** Whether an admin should be notified to review this application. */
  adminReview: boolean;
};

export const evaluateStory = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<EvaluationResult> => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Missing GEMINI_API_KEY");

    // Fast-path: completely empty or near-empty reflection is a hard block.
    // We still call the model on anything with real content so that judgement
    // is about MEANING and RELEVANCE, not length or word count.
    const trimmed = data.story.trim();
    if (trimmed.length === 0) {
      return {
        verdict: "red_block",
        headline: "Nothing was written in your reflection.",
        reason:
          "The reflection field was empty. Please share a few honest sentences about why you are stepping into this ceremony before continuing.",
        canProceed: false,
        adminReview: false,
      };
    }

    const system = `You are the "Ceremony-In" application reviewer for AIME IMAGI-NATION, a mentoring movement.
You evaluate the applicant's reflection for genuine willingness and interest in joining a mentoring, imagination and custodianship community.

Judge MEANING and RELEVANCE, not length. A short but sincere reflection can be green. A long but empty, off-topic, sarcastic or copy-pasted reflection is not green. Never decide based on word count alone.

Return one of four verdicts:
- "green": Meaningful and relevant. Shows real motivation, curiosity, care, lived experience, or interest in mentoring, imagination, community or custodianship. Accept straight away.
- "yellow": Ambiguous, generic, or unclear motivation, but not hostile. A human should verify.
- "red_flag": Something was written but it is insufficient, off-topic, or does not meet the criteria. The applicant CAN still proceed, and an admin will be notified to review.
- "red_block": Completely irrelevant, empty in spirit, spam, gibberish, hostile, or a clear refusal to engage. The applicant CANNOT proceed and must resubmit.

Be warm but honest. Never use em dashes or en dashes in any output text.`;

    const user = `Applicant name: ${data.name || "(not shared)"}
Chosen Visa Path: ${data.path || "(not chosen)"}

Four beings the applicant brings with them:
${(data.beings && data.beings.length ? data.beings : ["(none named)"]).map((b, i) => `${i + 1}. ${b}`).join("\n")}

Reflection:
"""
${data.story}
"""

Respond ONLY as JSON with keys:
  verdict: one of "green", "yellow", "red_flag", "red_block"
  headline: short human sentence, under 90 chars, no em dashes
  reason: 2 to 3 sentences of warm honest feedback, no em dashes`;

    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI gateway error ${res.status}: ${text}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: Partial<EvaluationResult> = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    const raw = String(parsed.verdict ?? "").toLowerCase();
    let verdict: Verdict =
      raw === "green"
        ? "green"
        : raw === "red_block" || raw === "red-block" || raw === "block"
        ? "red_block"
        : raw === "red_flag" || raw === "red-flag" || raw === "flag" || raw === "red"
        ? "red_flag"
        : "yellow";

    // A Golden Ticket turns a red flag into a yellow flag: the applicant still
    // needs human review, but they are not turned away at the river.
    const hasGoldenTicket = Boolean(data.goldenTicket?.trim());
    if (hasGoldenTicket && verdict === "red_flag") {
      verdict = "yellow";
    }

    const clean = (s: string) => s.replace(/\u2014|\u2013/g, ",");

    const fallbackHeadline =
      verdict === "green"
        ? "Your reflection lands with heart."
        : verdict === "yellow"
        ? "Your reflection needs a human set of eyes."
        : verdict === "red_flag"
        ? "Something was shared, but it needs a closer look."
        : "This reflection is not ready for the river yet.";

    const fallbackReason =
      verdict === "green"
        ? "A mentor will read your words with care and meet you at the first bend of the river."
        : verdict === "yellow"
        ? "A mentor will read your reflection with their own eyes before you continue."
        : verdict === "red_flag"
        ? "You wrote something, and you can continue, but an admin will review your reflection because it did not fully meet the criteria."
        : "The reflection did not show meaningful engagement with the ceremony. Please try again with a few honest sentences.";

    return {
      verdict,
      headline: parsed.headline ? clean(String(parsed.headline)) : fallbackHeadline,
      reason: parsed.reason ? clean(String(parsed.reason)) : fallbackReason,
      canProceed: verdict !== "red_block",
      adminReview: verdict === "yellow" || verdict === "red_flag",
    };
  });
