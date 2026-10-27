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
  /** The answer chosen for each multiple-choice question. */
  answers?: { statementId: number; choiceId: string }[];
};

/** One multiple-choice answer, with the wording as it stood when stored. */
export type AnswerRecord = {
  statementId: number;
  question: string;
  choiceId: string;
  answer: string | null;
  /** Whether it was the correct answer; null when the question has none. */
  correct: boolean | null;
};

export type AgreementRecord = {
  slug: string;
  title: string | null;
  /** Revision the applicant was shown. */
  shownRevisionId: number | null;
  /** Revision live in the CMS when the submission was stored. */
  liveRevisionId: number | null;
  /** sha256 of the live text (titles, body, statements, questions), so the exact wording is provable. */
  textSha256: string | null;
  acceptedStatementIds: number[];
  answers: AnswerRecord[];
  /**
   * The version shown is the live one, every statement was ticked and every
   * question answered (correctly, where a question has a correct answer).
   */
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
    // Statements keep their original line format, so hashes of agreements
    // without questions match records stored before questions existed.
    ...a.statements.map((s) =>
      s.kind === "question"
        ? `${s.id}:question:${s.text}:${s.choices
            .map((c) => `${c.id}=${c.correct ? "*" : ""}${c.text}`)
            .join("|")}`
        : `${s.id}:${s.text}`,
    ),
  ].join("\n");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Builds the consent record stored in "Agreements Accepted". The client says
 * what it showed, ticked and answered; the server checks that against the
 * live CMS so the record cannot claim acceptance of text that was not there,
 * or a correct answer that was not given.
 */
export async function buildAgreementRecords(
  submitted: SubmittedAgreement[],
): Promise<AgreementRecord[]> {
  const live = await loadAgreements();
  return submitted.map((entry) => {
    const accepted = [...new Set(entry.acceptedStatementIds)].sort((a, b) => a - b);
    const chosen = new Map((entry.answers ?? []).map((a) => [a.statementId, a.choiceId]));
    const current = live?.find((a) => a.slug === entry.slug);
    if (!current) {
      return {
        slug: entry.slug,
        title: null,
        shownRevisionId: entry.revisionId,
        liveRevisionId: null,
        textSha256: null,
        acceptedStatementIds: accepted,
        answers: [...chosen].map(([statementId, choiceId]) => ({
          statementId,
          question: "",
          choiceId,
          answer: null,
          correct: null,
        })),
        allAccepted: false,
        verified: false,
      };
    }

    const statementIds = current.statements.filter((s) => s.kind === "statement").map((s) => s.id);
    const answers: AnswerRecord[] = current.statements
      .filter((s) => s.kind === "question")
      .map((s) => {
        const choiceId = chosen.get(s.id) ?? "";
        const choice = s.choices.find((c) => c.id === choiceId);
        const hasCorrect = s.choices.some((c) => c.correct);
        return {
          statementId: s.id,
          question: s.text,
          choiceId,
          answer: choice?.text ?? null,
          correct: choice && hasCorrect ? choice.correct : null,
        };
      });
    const questionsDone = answers.every((a) => a.answer !== null && a.correct !== false);

    return {
      slug: current.slug,
      title: current.headerTitle,
      shownRevisionId: entry.revisionId,
      liveRevisionId: current.revisionId,
      textSha256: agreementTextHash(current),
      acceptedStatementIds: accepted.filter((id) => statementIds.includes(id)),
      answers,
      allAccepted:
        entry.revisionId === current.revisionId &&
        statementIds.every((id) => accepted.includes(id)) &&
        questionsDone,
      verified: true,
    };
  });
}
