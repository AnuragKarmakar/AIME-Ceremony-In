import process from "node:process";

// Server-only: the .server.ts suffix keeps this (and the Airtable token it
// reads) out of the client bundle.
//
// A Golden Ticket is a number in the Airtable `Tickets` table. It is only
// honoured when the ticket is linked to an `Applicant` whose name matches the
// first and last name the applicant gave, so a number alone is not enough.

export type TicketCheck = "valid" | "invalid" | "unavailable";

/** Ticket numbers are plain digits (1 to 1000 today); the cap leaves room for growth. */
const TICKET_PATTERN = /^\d{1,6}$/;

const normalizeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * Case, accent and punctuation insensitive. Accepts an exact "first last"
 * match, or an Airtable name with extra middle names ("Ada Mae Lovelace" for
 * "Ada" + "Lovelace").
 */
export function nameMatches(applicantName: string, firstName: string, lastName: string): boolean {
  const applicant = normalizeName(applicantName);
  const first = normalizeName(firstName);
  const last = normalizeName(lastName);
  if (!applicant || !first || !last) return false;
  return (
    applicant === `${first} ${last}` ||
    (applicant.startsWith(`${first} `) && applicant.endsWith(` ${last}`))
  );
}

function getConfig() {
  const token = process.env.AIRTABLE_TICKETS_TOKEN;
  const baseId = process.env.AIRTABLE_TICKETS_BASE_ID;
  const ticketTable = process.env.AIRTABLE_TICKETS_TICKET_TABLE;
  const applicantTable = process.env.AIRTABLE_TICKETS_APPLICANT_TABLE;
  if (!token || !baseId || !ticketTable || !applicantTable) return null;
  return { token, baseId, ticketTable, applicantTable };
}

async function airtableGet<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    // Status only: the body can echo applicant data.
    throw new Error(`Airtable returned ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * Checks a ticket number against Airtable. Never throws: an Airtable outage
 * returns "unavailable" so callers can fail closed (the ticket is not honoured)
 * without breaking the applicant's flow.
 */
export async function checkGoldenTicket(
  ticket: string | undefined,
  firstName: string | undefined,
  lastName: string | undefined,
): Promise<TicketCheck> {
  const code = (ticket ?? "").trim();
  if (!TICKET_PATTERN.test(code)) return "invalid";
  if (!(firstName ?? "").trim() || !(lastName ?? "").trim()) return "invalid";

  const config = getConfig();
  if (!config) {
    console.error("Golden Ticket validation is not configured (AIRTABLE_TICKETS_* env vars).");
    return "unavailable";
  }

  const { token, baseId, ticketTable, applicantTable } = config;
  const root = `https://api.airtable.com/v0/${encodeURIComponent(baseId)}`;

  try {
    // `code` is digits only (checked above), so it is safe inside the formula.
    const formula = encodeURIComponent(`TRIM({Ticket #})="${code}"`);
    const tickets = await airtableGet<{ records: { fields: { Applicant?: string[] } }[] }>(
      `${root}/${encodeURIComponent(ticketTable)}?maxRecords=5&filterByFormula=${formula}&fields%5B%5D=Applicant`,
      token,
    );

    const applicantIds = [
      ...new Set(tickets.records.flatMap((record) => record.fields.Applicant ?? [])),
    ];
    // Unknown number, or a ticket nobody has claimed yet: nothing to match a name to.
    if (applicantIds.length === 0) return "invalid";

    // Airtable record ids; checked before they go into a formula.
    const safeIds = applicantIds.filter((id) => /^rec[A-Za-z0-9]{14}$/.test(id));
    if (safeIds.length === 0) return "invalid";

    // A list query (not a per-record GET) so `fields[]` can limit the response
    // to the name: the Applicant table also holds email and phone numbers.
    const idFormula = encodeURIComponent(
      `OR(${safeIds.map((id) => `RECORD_ID()="${id}"`).join(",")})`,
    );
    const applicants = (
      await airtableGet<{ records: { fields: { Name?: string } }[] }>(
        `${root}/${encodeURIComponent(applicantTable)}?filterByFormula=${idFormula}&fields%5B%5D=Name`,
        token,
      )
    ).records;

    return applicants.some((a) => nameMatches(a.fields.Name ?? "", firstName!, lastName!))
      ? "valid"
      : "invalid";
  } catch (e) {
    console.error("Golden Ticket lookup failed:", e instanceof Error ? e.message : e);
    return "unavailable";
  }
}
