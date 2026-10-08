import { createHash } from "node:crypto";
import { loadAgreements, type AgreementContent } from "./wagtail.functions";

// Server-only (.server.ts): uses node:crypto, which must never reach the
// client bundle that also loads submit.functions.ts.

/** What the client reports for one agreement on the Agreements step. */
export type SubmittedAgreement = {
  slug: string;
  /** Revision the applicant was shown (null for hardcoded fallback copy). */
  revisionId: number | null;
  acceptedStatementIds: number[];
};

export type AgreementRecord = {
  slug: string;
  title: string | null;
  /** Revision the applicant was shown. */
  shownRevisionId: number | null;
  /** Revision live in the CMS when the submission was stored. */
  liveRevisionId: number | null;
  /** sha256 of the live text (titles, body, statements), so the exact wording is provable. */
  textSha256: string | null;
  acceptedStatementIds: number[];
  /** Every statement of the live version was ticked, and that version is the one shown. */
  allAccepted: boolean;
  /** False when the CMS could not be reached or no longer has this agreement. */
  verified: boolean;
};

function agreementTextHash(a: AgreementContent): string {
  const text = [
    a.headerTitle,
    a.headerDescription,
    a.bodyTitle,
    a.bodyDescription,
    a.submissionTitle,
    a.submissionDescription,
    ...a.statements.map((s) => `${s.id}:${s.text}`),
  ].join("\n");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Builds the consent record stored in "Agreements Accepted". The client says
 * what it showed and what was ticked; the server checks that against the
 * live CMS so the record cannot claim acceptance of text that was not there.
 */
export async function buildAgreementRecords(
  submitted: SubmittedAgreement[],
): Promise<AgreementRecord[]> {
  const live = await loadAgreements();
  return submitted.map((entry) => {
    const accepted = [...new Set(entry.acceptedStatementIds)].sort((a, b) => a - b);
    const current = live?.find((a) => a.slug === entry.slug);
    if (!current) {
      return {
        slug: entry.slug,
        title: null,
        shownRevisionId: entry.revisionId,
        liveRevisionId: null,
        textSha256: null,
        acceptedStatementIds: accepted,
        allAccepted: false,
        verified: false,
      };
    }
    const liveIds = current.statements.map((s) => s.id);
    return {
      slug: current.slug,
      title: current.headerTitle,
      shownRevisionId: entry.revisionId,
      liveRevisionId: current.revisionId,
      textSha256: agreementTextHash(current),
      acceptedStatementIds: accepted.filter((id) => liveIds.includes(id)),
      allAccepted:
        entry.revisionId === current.revisionId && liveIds.every((id) => accepted.includes(id)),
      verified: true,
    };
  });
}
