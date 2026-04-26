# Bijan — Job Application Portal Build Plan

> Live task tracker. Tick items off as we complete them. Delete this file when everything is done (task 8.5).

## Context

This repo started as a clone of [career-ops](https://github.com/santifer/career-ops) — a CLI-driven AI job-search system that already implements ~80% of the desired flow across CLI modes and a Go terminal UI. We are extending it into a personal **Bijan** job-application portal:

1. 3-bucket triage (Approve / Reject / Manual) on top of the existing 8-state lifecycle.
2. Cloud database via **Supabase** (Postgres + Auth + Storage), replacing markdown as the structured source of truth. Reports stay as markdown documents in Storage so the AI agents can still read them.
3. **Next.js + Tailwind + shadcn/ui** web portal, deployed to Vercel.
4. Stage + 1-click submit (Playwright opens form pre-filled, *user* clicks Submit).
5. Structured interview-prep question bank in Postgres (no embeddings / no RAG).
6. Whole repo pushed to **GitHub** (private), with user data + secrets gitignored.

---

## Flowchart 1 — As-Is

```mermaid
flowchart TD
    A[cv.md + config/profile.yml<br/>Manually authored] --> B
    B[scan.mjs<br/>Greenhouse / Ashby / Lever / Workday APIs<br/>+ data/pipeline.md for manual URLs] --> C
    C[modes/oferta.md<br/>A-F LLM evaluation<br/>NO embeddings, pure reasoning] --> D
    D[reports/NNN-company-DATE.md<br/>Score 0-5, blocks A-F + G]
    D --> E[modes/pdf.md → tailored HTML/PDF CV]
    D --> F[modes/apply.md<br/>Form Q&A from active Chrome tab<br/>STOPS before Submit]
    F --> G[applications.md<br/>8 statuses, manual updates]
    G --> H[modes/interview-prep.md<br/>Plain markdown story bank]
    G --> I[Go TUI dashboard<br/>terminal-only]

    style F fill:#fff3cd
    style I fill:#fff3cd
```

## Flowchart 2 — Proposed (To-Be)

```mermaid
flowchart TD
    A[Profile<br/>Supabase: profile table<br/>CV + goals + archetypes] --> B
    B[Job Sources<br/>1. scan.mjs API scanner<br/>2. Manual URL paste<br/>3. LinkedIn screenshot drop] --> B1[Supabase: jobs table]
    B1 --> C[Evaluation Worker<br/>Calls oferta.md<br/>Writes confidence 0-100<br/>+ markdown report to Storage]
    C --> C1[Supabase: evaluations table<br/>+ Storage: reports bucket]
    C1 --> D{Web Portal<br/>Triage view}
    D -->|Approve| E
    D -->|Reject| F
    D -->|Manual| G
    E[STAGE Pipeline<br/>1. pdf.md → tailored CV<br/>2. apply.md → form answers<br/>3. Playwright opens form pre-filled]
    E --> E1[YOU click Submit<br/>One human click]
    E1 --> H[applications.status = Applied]
    F[applications.triage = Reject<br/>+ reject_reason logged]
    G[applications.triage = Manual<br/>You apply yourself]
    G --> H
    H --> I[Lifecycle continues<br/>Applied → Responded →<br/>Interview → Offer / Rejected]
    I --> J[Interview Prep page<br/>questions table:<br/>tag search + manual add]

    style D fill:#ffe082
    style E fill:#c8e6c9
    style F fill:#ffcdd2
    style G fill:#ce93d8
    style E1 fill:#fff59d
    style B1 fill:#bbdefb
    style C1 fill:#bbdefb
```

---

## Architecture

```
GitHub repo (private)
└── Bijan/
    ├── modes/                  # career-ops AI prompts (unchanged, reused)
    ├── *.mjs                   # career-ops scripts (unchanged, reused)
    ├── dashboard/              # Go TUI (kept as backup view)
    ├── portal/                 # NEW — Next.js web app
    │   ├── app/                # App Router pages
    │   ├── components/         # shadcn/ui + custom
    │   ├── lib/supabase.ts     # Supabase client
    │   └── api/                # Route handlers that shell out to .mjs scripts
    ├── supabase/               # NEW
    │   ├── migrations/         # SQL migrations
    │   └── seed.sql            # initial profile seed
    └── stage-form.mjs          # NEW — Playwright pre-fill
```

**Hosting:** Portal on Vercel. Supabase managed. Both have free tiers.

---

## Supabase Schema

```sql
-- Singleton: your profile
create table profile (
  id uuid primary key default gen_random_uuid(),
  cv_md text not null,
  goals_md text,
  archetypes jsonb,
  updated_at timestamptz default now()
);

-- Job postings
create table jobs (
  id uuid primary key default gen_random_uuid(),
  source_type text check (source_type in ('api','manual_url','screenshot')),
  source_url text,
  company text,
  title text,
  raw_jd text,
  screenshot_path text,
  scanned_at timestamptz default now(),
  unique(source_url)
);

-- Evaluations
create table evaluations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  confidence_score int check (confidence_score between 0 and 100),
  letter_grade text,
  block_a jsonb, block_b jsonb, block_c jsonb,
  block_d jsonb, block_e jsonb, block_f jsonb,
  report_md_path text,
  evaluated_at timestamptz default now()
);

-- Applications (triage + lifecycle)
create table applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade unique,
  triage text check (triage in ('approve','reject','manual')),
  status text check (status in ('evaluated','applied','responded','interview','offer','rejected','discarded','skip')) default 'evaluated',
  reject_reason text,
  applied_at timestamptz,
  updated_at timestamptz default now()
);

-- Tailored CV versions
create table cv_versions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  html text,
  pdf_path text,
  generated_at timestamptz default now()
);

-- Form Q&A
create table form_answers (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  question text not null,
  answer text not null,
  source text check (source in ('report','manual','edited'))
);

-- Interview question bank
create table interview_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  tags text[],
  source_job_id uuid references jobs(id) on delete set null,
  created_at timestamptz default now()
);

create index on applications(triage);
create index on applications(status);
create index on evaluations(confidence_score desc);
create index on interview_questions using gin(tags);
```

**Storage buckets:** `cvs`, `screenshots`, `reports` (all private).

---

## Detailed Task List

### Phase 0 — Repo & GitHub setup ✅
- [x] **0.0** Copy plan to `Bijan/Bijan/plan.md` (this file)
- [x] **0.1** Init git
- [x] **0.2** Update `.gitignore`: added `.env.local`, `interview-prep/`, `portal/.next/`, `portal/node_modules/`, `*.pdf`
- [x] **0.3** Extended `.env.example` with Supabase + Anthropic keys
- [x] **0.4** First commit: `chore: import career-ops base + Bijan plan` (188 files, sensitive paths verified excluded)
- [x] **0.5** Pushed to https://github.com/AI-Tutor1/Bijan (private)
- [ ] **0.6** Portal README — deferred to Phase 6 once `portal/` exists

### Phase 1 — Supabase project ✅
- [x] **1.1** Project created at supabase.com (ref: `fmrcvqhfzbfcueuowdzo`)
- [x] **1.2** Keys saved to `Bijan/.env.local` (gitignored)
- [x] **1.3** Created folder `Bijan/supabase/migrations/`
- [x] **1.4** Wrote migration `0001_initial_schema.sql`
- [x] **1.5** Migration applied (verified by `scripts/setup-supabase.mjs`)
- [x] **1.6** Buckets `cvs`, `screenshots`, `reports` created (private)
- [x] **1.7** Profile row seeded with `examples/cv-example.md` (will be replaced via portal Profile page in Phase 6.9)
- [x] **1.8** Helper script `scripts/setup-supabase.mjs` (idempotent bootstrap)

### Phase 2 — Numeric confidence in oferta.md ✅ (mostly)
- [x] **2.1** `modes/oferta.md` now emits `**Confidence:** {NN}/100` in report header + directive explaining formula `round(score × 20)`
- [x] **2.2** Confirmed scale in `modes/_shared.md` is **1-5** (not 0-5 — adjusted plan accordingly; `score × 20` yields 20-100)
- [ ] **2.3** Run oferta on a real JD URL — *deferred until you have a JD to test with; not a blocker*

### Phase 3 — Triage column on application records
- [ ] **3.1** Schema covers it (Phase 1.4)
- [ ] **3.2** Edit `modes/tracker.md` — document new triage vocab
- [ ] **3.3** Edit `templates/states.yml` — add `triage:` enum
- [ ] **3.4** Write `migrate-applications-to-supabase.mjs` (idempotent on `job.source_url`)
- [ ] **3.5** Run migration script

### Phase 4 — Stage mode (Playwright pre-fill, no auto-submit)
- [ ] **4.1** Create `modes/stage.md` — agent prompt
- [ ] **4.2** Create `stage-form.mjs` — Playwright runner (visible mode, no submit)
- [ ] **4.3** Reuse `generate-pdf.mjs` for CV upload step
- [ ] **4.4** Test with one Greenhouse and one Workday URL

### Phase 5 — Question bank
- [ ] **5.1** Schema covers it (Phase 1.4)
- [ ] **5.2** Edit `modes/interview-prep.md` — INSERT new STAR stories into `interview_questions`
- [ ] **5.3** Build the portal page (Phase 6.8)

### Phase 6 — Web portal (Next.js + Tailwind + shadcn/ui)

**6.1 — Scaffold**
- [ ] `npx create-next-app@latest portal --ts --tailwind --app`
- [ ] Install: `@supabase/supabase-js`, `@supabase/ssr`, `lucide-react`, `react-markdown`, `gray-matter`
- [ ] `npx shadcn@latest init`; add: `button card tabs dialog input textarea badge table dropdown-menu toast sonner`
- [ ] Create `lib/supabase/server.ts` and `lib/supabase/client.ts`

**6.2 — Layout & nav**
- [ ] `app/layout.tsx` — sidebar nav: Dashboard / Inbox / Approved / Rejected / Manual / Applied / Interview Prep / Profile
- [ ] Dark theme (Catppuccin-ish to match the Go TUI)

**6.3 — Dashboard (`/`)**
- [ ] List jobs joined with `evaluations.confidence_score` desc
- [ ] Columns: Company, Title, Score, Triage, Status, Date
- [ ] Row click → `/job/[id]`

**6.4 — Job detail (`/job/[id]`)**
- [ ] Render markdown report from Storage
- [ ] Three big buttons: Approve (green) / Reject (red) / Manual (purple)
- [ ] Approve → `/api/jobs/[id]/approve` → spawns `stage-form.mjs`
- [ ] Reject → dialog for reason → `triage=reject, status=discarded`
- [ ] Manual → `triage=manual`

**6.5 — Triage tabs (`/approved`, `/rejected`, `/manual`)**
- [ ] Filtered table views

**6.6 — Lifecycle view (`/applied`)**
- [ ] Kanban: Applied / Responded / Interview / Offer / Rejected
- [ ] "Mark applied" button on Approved-but-not-Applied rows

**6.7 — Intake (`/intake`)**
- [ ] URL paste → `/api/intake/url` → triggers `oferta`
- [ ] Screenshot drop → `screenshots` bucket → Claude Vision extracts → eval
- [ ] Raw JD text → directly into `jobs.raw_jd`

**6.8 — Interview Prep (`/interview-prep`)**
- [ ] Search bar (text + tag filter)
- [ ] Question list with collapsible answers
- [ ] "Add question" dialog
- [ ] Tag chips, click-to-filter

**6.9 — Profile (`/profile`)**
- [ ] Edit `cv_md`, `goals_md`, archetypes
- [ ] Save → upserts `profile` row
- [ ] "Export to cv.md" button (writes file so CLI modes still work)

**6.10 — API routes that shell out to existing scripts**
- [ ] `app/api/jobs/[id]/approve/route.ts`
- [ ] `app/api/intake/url/route.ts`
- [ ] `app/api/eval/[id]/route.ts`

### Phase 7 — Evaluation worker bridge
- [ ] **7.1** `portal/lib/run-eval.ts` — wraps shell-out + Supabase write-back
- [ ] **7.2** Modify oferta to emit a fenced `json` block with `{score, letter, blocks}`
- [ ] **7.3** Synchronous spawn at first; upgrade to queue later if needed

### Phase 8 — Deploy
- [ ] **8.1** Push portal to GitHub
- [ ] **8.2** Connect repo to Vercel; set env vars
- [ ] **8.3** Add Supabase migrations to CI: `supabase db push` on main
- [ ] **8.4** Domain (optional): `bijan.<yourdomain>`
- [ ] **8.5** **Delete this `plan.md`** once everything above is checked

---

## Verification

| # | Test | Expected |
|---|---|---|
| 1 | Push to GitHub | `git push` succeeds; `.env`, `data/`, `reports/`, `output/` not in repo |
| 2 | Supabase tables | `select * from jobs limit 1` works in SQL editor |
| 3 | Numeric confidence | Run oferta on a JD; report contains `Confidence: NN/100` |
| 4 | Migration script | After running, `select count(*) from applications` matches old applications.md row count |
| 5 | Stage mode | `node stage-form.mjs <id>` opens visible Playwright with form pre-filled, no submit |
| 6 | Portal — Approve | Click Approve; `applications.triage='approve'`; Playwright window opens |
| 7 | Portal — Reject | Click Reject; row moves to Rejected tab |
| 8 | Portal — Manual | Click Manual; row appears in Manual tab |
| 9 | Lifecycle | Move card from Applied → Interview; row updates in DB |
| 10 | Question bank | Add 3 questions; tag-filter works; search returns matches |
| 11 | Intake — URL | Paste URL, eval runs, job appears in Inbox |
| 12 | Intake — screenshot | Drop image, Claude Vision extracts, eval runs |
| 13 | Profile sync | Edit profile, click Export, `cat cv.md` shows new content |
| 14 | Vercel deploy | Production URL responds; Supabase queries work |

---

## Risks / Open Items

- **Auth.** Plan assumes single-user with service-role key on the server. If you ever share the URL, add Supabase Auth + RLS — separate ~half-day task.
- **Vercel timeout (10s on free tier).** Long evaluations may need Supabase Edge Functions or a queue. Initial workaround: run evals locally via CLI; portal just displays.
- **Cost.** Free tiers cover personal use. Anthropic API is the only paid piece.
- **GitHub leakage.** Triple-check `.gitignore` before first push: `data/`, `reports/`, `output/`, `interview-prep/`, plus `*.env*` (except `.env.example`).

## Out of Scope (deferred)

- Vector DB / true RAG.
- Fully automatic form submission.
- LinkedIn browser extension.
- Email/calendar sync.
- Multi-user / public hosting.
