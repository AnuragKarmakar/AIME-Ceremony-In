import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { checkGoldenTicket } from "./golden-ticket.server";

const InputSchema = z.object({
  ticket: z.string().max(20),
  firstName: z.string().max(200),
  lastName: z.string().max(200),
});

export type VerifyTicketResult = "valid" | "invalid" | "unavailable" | "rate_limited";

// Ticket numbers are short, so without a limit anyone could walk through all
// of them. In-memory and per-process, which is enough to make that impractical
// on the single server this runs on.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 15;
const attempts = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(key, recent);
  // Keep the map from growing without bound on a long-running server.
  if (attempts.size > 5_000) {
    for (const [k, times] of attempts) {
      if (times.every((t) => now - t >= WINDOW_MS)) attempts.delete(k);
    }
  }
  return recent.length > MAX_ATTEMPTS_PER_WINDOW;
}

/**
 * Tells the identity step whether a Golden Ticket belongs to the person who
 * entered it. Deliberately answers only valid/invalid, so it cannot be used to
 * learn whether a number exists or who it belongs to.
 */
export const verifyGoldenTicket = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<VerifyTicketResult> => {
    const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    if (isRateLimited(ip)) return "rate_limited";
    return checkGoldenTicket(data.ticket, data.firstName, data.lastName);
  });
