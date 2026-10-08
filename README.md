# Ceremony-In · AIME IMAGI-NATION

A warm, story-driven onboarding flow for the AIME IMAGI-NATION mentoring movement. Instead of a traditional sign-up form, applicants choose a Visa Path, share a personal reflection (evaluated by Gemini for genuine engagement), complete a 39-section relational check-in quiz, accept the movement's agreements, and receive a ceremony verdict that unlocks their next steps on the "River Run."

Live: http://3.217.19.123/

## Features

- **8-step guided ceremony** — Welcome → Visa Path → Who you are → Your story → Ceremony (verdict) → Relational Check-in → Agreements → River Run, with animated forward/back transitions, XP and level progress, and an ambient animated background that respects `prefers-reduced-motion`.
- **Visa Paths** — five entry doorways into the movement (Joy Corp, IMAGI-NATION Presidents, IMAGI-NATION Schools, Systems Change Citizens, Indigenous Knowledge Systems Labs). Their copy (name, tagline, description, order) comes from the Wagtail CMS; icons, colours and banners stay in the frontend.
- **AI-reviewed reflection** — the applicant's written reflection and the "four beings" they name are sent to Gemini, which returns a verdict (`green` / `yellow` / `red_flag` / `red_block`) with a warm, human-readable headline and reason. `red_block` stops the applicant; `yellow` and `red_flag` can continue and are marked for admin review. If Gemini is temporarily overloaded (HTTP 503), the applicant is offered a "Skip and continue" option, recorded as `yellow` with admin review.
- **Golden Ticket** — an optional numeric ticket, verified against Airtable and the applicant's name (see below).
- **Relational Check-in quiz** — 39 themed sections (Imagination, Economics, the 7 Elements of Relations, Mentoring, Logic fallacies, Systems, etc.) covering 60+ questions, paginated one section at a time with slider inputs and dot progress. Answers are stored with the submission but are not scored or sent to the AI evaluation.
- **Agreements** — after the quiz, the applicant reads each agreement (for example the Social Contract and Healthy Child Protection) and ticks every statement individually before continuing. Agreements and their statements are managed in the Wagtail CMS.
- **River Run** — a gamified preview of the mentoring pathway stages that unlock after Ceremony-In (Meet your Mentor, Cohort Circle, First Ripple Project, River Council, Custodian).
- **Progress saved in the browser** — in-progress answers are kept in `localStorage`, so a refresh or closed tab shows a "Welcome back" prompt on return. The saved progress is cleared on completion or when the applicant chooses to start fresh.
- **Submissions to Airtable** — each completed ceremony is written to an Airtable table by a server function (see Environment variables).

### Golden Ticket

A Golden Ticket means someone has already vouched for the applicant, so the reflection can never block them.

**Validation.** A ticket is a number (digits only) from the `Tickets` table in a separate Airtable base. It only counts when the ticket is linked to an `Applicant` record whose `Name` matches the first and last name entered. The match ignores case, accents and punctuation, and allows middle names. Unknown numbers, tickets nobody has claimed, and names that don't match are all treated as invalid, and the app never says which of these it was.

- The identity step checks the ticket when the applicant presses Continue (the first point where both names are known). A mismatch shows a message and offers "Continue without a Golden Ticket".
- `evaluateStory` and `submitCeremony` check it again on the server, so a tampered browser cannot claim a ticket. `Has Golden Ticket` in the submissions table is only true for a verified ticket; the number as typed is stored in `Golden Ticket`.
- Lookups are limited to 15 per IP address per 10 minutes, to stop anyone walking through the numbers.
- If Airtable is unreachable the ticket is not honoured (the check fails closed), and the applicant is told to retry or continue without it.

**Approval rules** for a verified ticket:

- Golden Ticket holders are always approved once they complete the required ceremony steps.
- Their reflection is still reviewed. A strong reflection gives a `green` verdict; a weak, empty or unreviewable one (including Gemini being unavailable) is approved as `yellow` and flagged for admin review.
- The result screen shows "Approved · Golden Ticket" instead of the usual "held for review" message.
- The ticket is stored on the record (`Golden Ticket` and `Has Golden Ticket`), and it unlocks early River Run stages.

The approval logic lives in [evaluate.functions.ts](src/lib/evaluate.functions.ts); the ticket check lives in [golden-ticket.server.ts](src/lib/golden-ticket.server.ts).

## Tech stack

- [TanStack Start](https://tanstack.com/start) (React 19) + [TanStack Router](https://tanstack.com/router) — full-stack React framework with file-based routing and server functions
- [Vite](https://vitejs.dev) + [Nitro](https://nitro.unjs.io) — build tooling and server runtime (`node-server` preset)
- [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) (Radix primitives) — styling and component primitives
- [Zod](https://zod.dev) — server function input validation
- [TanStack Query](https://tanstack.com/query) — client-side data fetching
- Google **Gemini API** (OpenAI-compatible endpoint) — reflection evaluation
- **Wagtail** CMS ([aime-ceremony-cms](../aime-ceremony-cms), Django) — Visa Path and Agreement content
- **Airtable** — submission storage and Golden Ticket validation
- Hosted on **AWS** (EC2 behind Caddy, with the Wagtail CMS alongside); [apprunner.yaml](apprunner.yaml) holds the App Runner configuration
- Managed with **[Lovable](https://lovable.dev)** — commits pushed to the connected branch sync back into the Lovable editor

## Project structure

```
src/
  routes/
    __root.tsx           # Root route: HTML shell, head tags, 404/error boundaries
    index.tsx             # The Ceremony-In wizard (steps, screens, state, progress saving)
  components/
    QuizScreen.tsx         # Relational Check-in quiz UI (one section per screen)
    AgreementsScreen.tsx   # Agreements step: per-statement acceptance
    LanguageCombobox.tsx   # Mother-tongue picker used on the identity step
    AmbientBackground.tsx  # Animated background
    SplashScreen.tsx       # Intro splash
    XpToast.tsx            # XP gain toast
    ui/                    # shadcn/ui primitives (button, slider, dialog, ...)
  hooks/
    use-mobile.tsx / use-reduced-motion.ts
  lib/
    evaluate.functions.ts  # Server function: Gemini reflection review + Golden Ticket rules
    submit.functions.ts    # Server function: writes a completed ceremony to Airtable
    golden-ticket.server.ts     # Server-only: checks a ticket number + name against Airtable
    golden-ticket.functions.ts  # Server function used by the identity step (rate limited)
    wagtail.functions.ts   # Server functions: fetch Visa Paths and Agreements from Wagtail
    quiz.data.ts            # All 39 quiz sections/questions/scales
    languages.ts             # Language list for the mother-tongue combobox
    error-capture.ts / error-page.ts / lovable-error-reporting.ts
                              # SSR error handling + Lovable error reporting
    utils.ts                # cn() and other shared helpers
  server.ts                # Fetch handler wrapping SSR errors
  start.ts                 # TanStack Start instance + server error middleware
  router.tsx                # Router setup
  styles.css                # Tailwind v4 theme tokens + animation keyframes
public/design/              # Visa path art, icons and logo
apprunner.yaml              # AWS App Runner build/run config
```

## Getting started

### Prerequisites

- Node.js 18+ (or [Bun](https://bun.sh), which this project is also configured for via `bunfig.toml`)
- A [Gemini API key](https://ai.google.dev) with access to a current Gemini model
- An Airtable base and personal access token for submissions
- Optional: the Wagtail CMS running locally (see below)

### Install

```bash
npm install
```

### Environment variables

Create a `.env` file in the project root:

```
GEMINI_API_KEY=your-gemini-api-key
AIRTABLE_TOKEN=your-airtable-personal-access-token
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
AIRTABLE_TABLE=Ceremony Submissions
WAGTAIL_API_URL=http://127.0.0.1:8001
AIRTABLE_TICKETS_TOKEN=your-airtable-personal-access-token
AIRTABLE_TICKETS_BASE_ID=appXXXXXXXXXXXXXX
AIRTABLE_TICKETS_TICKET_TABLE=tblXXXXXXXXXXXXXX
AIRTABLE_TICKETS_APPLICANT_TABLE=tblXXXXXXXXXXXXXX
```

- `GEMINI_API_KEY` is required. The reflection evaluation server function ([evaluate.functions.ts](src/lib/evaluate.functions.ts)) throws if it is missing, except for Golden Ticket holders, who are approved regardless. It is read via `process.env`, so when deploying it must be set in the hosting environment: `.env` is git-ignored and never deployed.
- `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID` and `AIRTABLE_TABLE` are required for submission storage. Completed submissions are written to Airtable from [submit.functions.ts](src/lib/submit.functions.ts), a server function, so the token never reaches the browser. That file is the only place that knows the Airtable column names.
- `AIRTABLE_TICKETS_*` configure Golden Ticket validation. The token needs `data.records:read` on the tickets base, which is a different base from the submissions one. `..._TICKET_TABLE` is the `Tickets` table (with a `Ticket #` column linked to `Applicant`) and `..._APPLICANT_TABLE` is the `Applicant` table (with a `Name` column). If any of these is missing, tickets are simply not honoured and everyone is reviewed as a normal applicant. Like the other secrets, they must be set in the hosting environment.
- `WAGTAIL_API_URL` is optional. Visa Path and Agreement copy is fetched from the Wagtail API by [wagtail.functions.ts](src/lib/wagtail.functions.ts), and the app falls back to hardcoded copy if the variable is unset or the CMS is unreachable.

### Run the Wagtail CMS (optional)

The CMS lives in a sibling repo, `aime-ceremony-cms` (Django + Wagtail, SQLite in development):

```bash
cd ../aime-ceremony-cms
python -m venv venv
./venv/Scripts/activate        # or: source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8001
```

Then set `WAGTAIL_API_URL=http://127.0.0.1:8001`. The API exposes `/api/v2/visapaths/` and `/api/v2/agreements/`, and content is edited in the Wagtail admin under Snippets. Port 8000 is the Django default, but on some Windows machines it falls in a reserved range, so 8001 is used here.

### Run the dev server

```bash
npm run dev
```

The app runs at `http://localhost:8080` by default (override with the `PORT` env var).

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run build:dev` | Development-mode build |
| `npm run preview` | Preview a production build locally |
| `npm run lint` | Run ESLint |
| `npm run format` | Format the codebase with Prettier |

## Notes

- The Gemini model used for evaluation is set in [evaluate.functions.ts](src/lib/evaluate.functions.ts). Google periodically retires model IDs for new API keys and projects, so if reflection evaluation starts failing with a `404`, check whether the configured model is still available to your key (`GET https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY`).
- This project is connected to Lovable — avoid force-pushing or rewriting history on the connected branch, since that history sync also drives the Lovable editor.
