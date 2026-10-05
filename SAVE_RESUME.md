# Save and Resume

An applicant's progress through Ceremony-In is saved automatically, without any explicit
"Save" button, and can be resumed either on the same browser or on a different one.

## Two independent save mechanisms

| | localStorage | Airtable |
|---|---|---|
| Scope | This browser only | Any browser/device |
| Written on | Every form change (cheap, no network) | Every step transition, once an email exists (network call, so throttled to step boundaries) |
| Used for | Instant "Welcome back" banner on the Welcome screen | Cross-device resume via "Started on another device?" email lookup |
| Cleared on | Reaching River Run, or the applicant choosing "Start fresh" | Never cleared — the Airtable record's `Status` flips from `Incomplete` to `Submitted` instead |

Both are best-effort and non-blocking: a storage failure (private browsing, Airtable down,
etc.) never stops the applicant from continuing — they just won't be able to resume later.

## How a save happens

`src/routes/index.tsx` has a `useEffect` keyed on `[stepIdx]` (not on every keystroke) that
calls `saveProgress` (`src/lib/submit.functions.ts`) once the applicant has entered a
syntactically valid email — i.e. from the Identity step onward. It sends whatever is in the
form at that moment (story, beings, quiz answers so far, agreements ticked so far, and the
reflection evaluation if one has run) and the current step's key (e.g. `"quiz"`).

`saveProgress` **upserts** the Airtable record by email: it looks up an existing row for
that email first, and `PATCH`es it if found rather than creating a new one. This is what lets
an applicant who resumes mid-flow and then finishes end up as a single row, not two — the
same upsert-by-email logic is used by the final `submitCeremony` call.

## How resume happens

- **Same browser** — on load, `loadSavedProgress()` reads localStorage. If present, the
  Welcome screen shows a "Welcome back" banner with Continue/Start fresh. Instant, no
  network call.
- **Different browser/device** — the Welcome screen also has a "Started on another device?"
  email field. Submitting it calls `fetchProgressByEmail`, which looks up the Airtable record
  for that email **with `Status = Incomplete`** and, if found, reconstructs the form and
  lands the applicant back on the step they left off at (`Last Step`). A `Status = Submitted`
  record is never returned here — a finished ceremony is not reopened for editing.
- There is deliberately no verification step (no magic link, no password) — consistent with
  the rest of the app having no accounts anywhere. Anyone who knows an applicant's email can
  pull up their in-progress answers; there is no sensitive data (no payment, no government
  ID) in this flow, so this tradeoff favors low friction over verification.

## Incomplete vs Submitted

Every Airtable row has a `Status` field: `Incomplete` while the applicant is still going
through the flow, `Submitted` once they finish (either by completing Agreements, or by being
blocked with a verdict that ends the flow early). This is what "Admin Dashboard handles
incomplete vs submitted records" means in practice here — Airtable *is* the admin dashboard,
and `Status` is the field to filter/view by.

## Validation and AI evaluation timing

- **Partial saves are not validated against the full submission schema.** `saveProgress`
  uses a relaxed schema (`SaveProgressInputSchema` in `submit.functions.ts`) where only the
  email needs to be well-formed — everything else can be empty or mid-typed, since the
  applicant may be anywhere in the flow.
- **Full validation runs at final submit** (`submitCeremony`'s `InputSchema`) and at each
  step's own "Continue" gate in the UI (e.g. the Identity step won't advance without a valid
  email; the Story step won't advance without 10+ characters and all 4 beings named).
- **Gemini (AI/LLM) evaluation runs exactly once per attempt, only when the Story step is
  submitted** (the `next()` handler's `step === "story"` branch calls `evaluateStory`).
  Partial saves never trigger it — they persist whatever evaluation result already exists in
  state (`null` until the applicant reaches and submits Story), so resuming before that point
  correctly resumes with no evaluation yet, and resuming after it correctly restores the
  verdict Gemini already returned rather than re-running the model.

## Airtable schema additions

Three fields were added to the submissions table (`Ceremony Submissions`,
`tblMBYwYSE42x0rN1`) to support this feature, on top of the fields already documented in
[DEPLOYMENT.md](DEPLOYMENT.md):

| Field | Type | Purpose |
|---|---|---|
| `Status` | Single select (`Incomplete`, `Submitted`) | Distinguishes in-progress from finished records |
| `Last Step` | Single line text | The step key (e.g. `"quiz"`) the applicant was on at last save, used to resume them at the right screen |
| `Agreements Accepted` | Long text (JSON) | Which agreement statements were ticked, keyed the same way the frontend tracks them (`${agreementSlug}:${statementId}`) — previously not stored at all |
