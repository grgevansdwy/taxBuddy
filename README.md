# TaxBuddy

TaxBuddy is a web app that helps international students and other nonresident aliens file their U.S. taxes correctly. Users upload their tax documents (W-2, 1099s, I-20, I-94, etc.), the app extracts the data, determines residency/tax-treaty eligibility, and generates filled-out 1040-NR and related forms.

## How it works

1. **Onboarding** — user answers eligibility questions (visa status, country, travel history) and uploads source documents.
2. **Extraction** — PDFs are parsed (LlamaParse) and structured data is pulled out via an LLM (OpenAI) against per-document Zod schemas.
3. **Rules engine** — substantial-presence/eligibility checks, tax-treaty benefits, and income rules determine which forms apply and what values go on them.
4. **Generation** — form templates are filled with `pdf-lib` and returned as completed PDFs (1040-NR, Schedule NEC/OI/A, Form 8833, Form 8843).

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + React 19 + TypeScript
- [Supabase](https://supabase.com) — auth and Postgres storage
- [OpenAI](https://platform.openai.com) — document field extraction
- [LlamaParse](https://cloud.llamaindex.ai) — PDF-to-markdown parsing
- `pdf-lib` — filling PDF form templates
- Tailwind CSS + shadcn/Radix (`base-ui`) components
- Zod for schema validation, Zustand for client state
- Vitest for tests

> **Note:** This project pins a Next.js version with breaking changes vs. the version most tooling/training data assumes. Check `node_modules/next/dist/docs/` before relying on familiar Next.js APIs.

## Project structure

```
app/
  (auth)/            sign in, sign up, password reset, email verify
  (protected)/       onboarding wizard + dashboard (requires auth)
  api/
    auth/            Supabase auth callback
    documents/       upload, extract, checklist, and form-generation endpoints
    eligibility/      substantial presence / treaty eligibility endpoint
    profile/         user profile endpoint
    filing/          filing status endpoint
    reduction/       tax-reduction/treaty-benefit endpoint
    dev/             local extraction/parsing preview tools

components/
  onboarding/        upload slots, wizard shell/nav, document cards
  ui/                shadcn-based primitives (button, card, input, ...)

lib/
  ai/                OpenAI client + markdown-based extraction pipeline
  parsing/           LlamaParse integration
  extraction/schemas/  per-document Zod schemas (W-2, 1099-B/DIV/INT, 1042-S, 1098-T, I-20, I-94)
  rules/             eligibility, income, treaty, and document-checklist logic
  rules/forms/        per-form (1040-NR, Schedule NEC/OI/A, 8833, 8843) computation
  pdf/
    templates/       blank IRS form PDFs
    fieldMaps/       field name -> PDF form field mappings
    fillForm.ts      fills a template from computed form data
  supabase/          Supabase client (browser + server)
  config/            static reference data (countries, US states, tax year, doc labels)

supabase/migrations/  database schema migrations
tests/golden/          golden-file tests for extraction/generation
```

## Getting started

### Prerequisites

- Node.js
- A Supabase project
- An OpenAI API key
- A LlamaCloud (LlamaParse) API key

### Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
LLAMA_CLOUD_API_KEY=
```

Apply database migrations in `supabase/migrations/` to your Supabase project, then run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other scripts

```bash
npm run build   # production build
npm run start   # run production build
npm run lint    # eslint
npx vitest      # run tests
```

## Dev tools

`/onboarding/dev/parse-preview` and the `app/api/dev/*` routes let you run the parse/extract pipeline against a document outside the full onboarding flow, useful when tuning extraction schemas or field maps.
