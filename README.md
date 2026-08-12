# Ceremony-In · AIME IMAGI-NATION

A warm, story-driven onboarding flow for the AIME IMAGI-NATION mentoring movement. Instead of a traditional sign-up form, applicants choose a Visa Path, share a personal reflection (evaluated by Gemini for genuine engagement), complete a 39-section relational check-in quiz, and receive a ceremony verdict that unlocks their next steps on the "River Run."

Live: https://aime-ceremony-in.vercel.app

## Features

- **7-step guided ceremony** — Welcome → Visa Path → Who you are → Your story → Relational Check-in → Ceremony (result) → River Run, with animated forward/back transitions between steps.
- **Visa Paths** — five entry doorways into the movement (Joy Corp, IMAGI-NATION Presidents, IMAGI-NATION Schools, Systems Change Citizens, Indigenous Knowledge Systems Labs).
- **AI-reviewed reflection** — the applicant's written reflection and the "four beings" they name are sent to Gemini, which returns a verdict (`green` / `yellow` / `red_flag` / `red_block`) with a warm, human-readable headline and reason. A Golden Ticket softens a `red_flag` verdict to `yellow`.
- **Relational Check-in quiz** — 39 themed sections (Imagination, Economics, the 7 Elements of Relations, Mentoring, Logic fallacies, Systems, etc.) covering 60+ questions, paginated one section at a time with slider inputs, dot progress, and staggered entrance animations. Answers are currently collected but not scored or sent to the AI evaluation.
- **River Run** — a gamified preview of the mentoring pathway stages that unlock after Ceremony-In (Meet your Mentor, Cohort Circle, First Ripple Project, River Council, Custodian).
- **Golden Ticket flow** — an optional referral code that unlocks early River Run stages and softens the reflection verdict.

## Tech stack

- [TanStack Start](https://tanstack.com/start) (React 19) + [TanStack Router](https://tanstack.com/router) — full-stack React framework with file-based routing and server functions
- [Vite](https://vitejs.dev) + [Nitro](https://nitro.unjs.io) — build tooling and server runtime
- [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) (Radix primitives) — styling and component primitives
- [Zod](https://zod.dev) — server function input validation
- [TanStack Query](https://tanstack.com/query) — client-side data fetching
- Google **Gemini API** (OpenAI-compatible endpoint) — reflection evaluation
- Deployed on **Vercel**
- Managed with **[Lovable](https://lovable.dev)** — commits pushed to the connected branch sync back into the Lovable editor

## Project structure

```
src/
  routes/
    __root.tsx           # Root route: HTML shell, head tags, 404/error boundaries
    index.tsx             # The entire Ceremony-In wizard (steps, screens, state)
  components/
    QuizScreen.tsx         # Relational Check-in quiz UI (one section per screen)
    LanguageCombobox.tsx   # Mother-tongue picker used on the identity step
    ui/                    # shadcn/ui primitives (button, slider, dialog, ...)
  lib/
    evaluate.functions.ts  # Server function: calls Gemini to evaluate a reflection
    quiz.data.ts            # All 39 quiz sections/questions/scales
    languages.ts             # Language list for the mother-tongue combobox
    error-capture.ts / error-page.ts / lovable-error-reporting.ts
                              # SSR error handling + Lovable error reporting
    utils.ts                # cn() and other shared helpers
  server.ts                # Cloudflare/Nitro-style fetch handler wrapping SSR errors
  start.ts                 # TanStack Start instance + server error middleware
  router.tsx                # Router setup
  styles.css                # Tailwind v4 theme tokens + animation keyframes
```

## Getting started

### Prerequisites

- Node.js 18+ (or [Bun](https://bun.sh), which this project is also configured for via `bunfig.toml`)
- A [Gemini API key](https://ai.google.dev) with access to a current Gemini model

### Install

```bash
npm install
```

### Environment variables

Create a `.env` file in the project root:

```
GEMINI_API_KEY=your-gemini-api-key
CEREMONY_API_URL=http://localhost:5110
```

`GEMINI_API_KEY` is required — the reflection evaluation server function ([evaluate.functions.ts](src/lib/evaluate.functions.ts)) throws if it's missing. It's read via `process.env`, so when deploying (e.g. to Vercel) it must be set directly in the hosting platform's environment variables — `.env` is git-ignored and never deployed.

`CEREMONY_API_URL` points at the [aime-mdlwr](../aime-mdlwr) middleware, which stores completed submissions in Airtable. It defaults to `http://localhost:5110`, so local development needs no setting; a deployed frontend must point it at the deployed middleware. Submission happens in [submit.functions.ts](src/lib/submit.functions.ts), a server function, so the middleware never needs to be publicly reachable from the browser.

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

- The Gemini model used for evaluation is set in [evaluate.functions.ts](src/lib/evaluate.functions.ts) — Google periodically retires model IDs for new API keys/projects, so if reflection evaluation starts failing with a `404`, check whether the configured model is still available to your key (`GET https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY`).
- This project is connected to Lovable — avoid force-pushing or rewriting history on the connected branch, since that history sync also drives the Lovable editor.
