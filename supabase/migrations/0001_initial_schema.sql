-- Bijan portal — initial schema
-- Apply via Supabase SQL editor or `supabase db push`.

set check_function_bodies = off;

-- =========================================================================
-- profile : singleton row holding the user's CV + goals + archetypes
-- =========================================================================
create table if not exists profile (
  id uuid primary key default gen_random_uuid(),
  cv_md text not null,
  goals_md text,
  archetypes jsonb,
  updated_at timestamptz not null default now()
);

-- =========================================================================
-- jobs : every job posting we've seen (from scan, manual paste, screenshot)
-- =========================================================================
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('api', 'manual_url', 'screenshot')),
  source_url text,
  company text,
  title text,
  raw_jd text,
  screenshot_path text,                              -- path in Storage `screenshots` bucket
  scanned_at timestamptz not null default now(),
  unique (source_url)
);

create index if not exists jobs_company_idx on jobs (company);
create index if not exists jobs_scanned_at_idx on jobs (scanned_at desc);

-- =========================================================================
-- evaluations : oferta.md output, one per job
-- =========================================================================
create table if not exists evaluations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs (id) on delete cascade,
  confidence_score int check (confidence_score between 0 and 100),
  letter_grade text,                                 -- A | B | C | D | E | F
  block_a jsonb,
  block_b jsonb,
  block_c jsonb,
  block_d jsonb,
  block_e jsonb,
  block_f jsonb,
  report_md_path text,                               -- path in Storage `reports` bucket
  evaluated_at timestamptz not null default now()
);

create index if not exists evaluations_job_id_idx on evaluations (job_id);
create index if not exists evaluations_score_idx on evaluations (confidence_score desc);

-- =========================================================================
-- applications : triage gate (Approve/Reject/Manual) + lifecycle status
-- =========================================================================
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs (id) on delete cascade unique,
  triage text check (triage in ('approve', 'reject', 'manual')),
  status text not null default 'evaluated' check (
    status in ('evaluated', 'applied', 'responded', 'interview', 'offer', 'rejected', 'discarded', 'skip')
  ),
  reject_reason text,
  applied_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists applications_triage_idx on applications (triage);
create index if not exists applications_status_idx on applications (status);

-- Auto-update updated_at on row change
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists applications_set_updated_at on applications;
create trigger applications_set_updated_at
  before update on applications
  for each row execute function set_updated_at();

drop trigger if exists profile_set_updated_at on profile;
create trigger profile_set_updated_at
  before update on profile
  for each row execute function set_updated_at();

-- =========================================================================
-- cv_versions : tailored CVs generated for each Approved job
-- =========================================================================
create table if not exists cv_versions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs (id) on delete cascade,
  html text,
  pdf_path text,                                     -- path in Storage `cvs` bucket
  generated_at timestamptz not null default now()
);

create index if not exists cv_versions_job_id_idx on cv_versions (job_id);

-- =========================================================================
-- form_answers : per-job form Q&A (apply.md Section G)
-- =========================================================================
create table if not exists form_answers (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs (id) on delete cascade,
  question text not null,
  answer text not null,
  source text check (source in ('report', 'manual', 'edited'))
);

create index if not exists form_answers_job_id_idx on form_answers (job_id);

-- =========================================================================
-- interview_questions : structured question bank (no embeddings)
-- =========================================================================
create table if not exists interview_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  tags text[] not null default '{}',
  source_job_id uuid references jobs (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists interview_questions_tags_idx on interview_questions using gin (tags);

-- =========================================================================
-- Notes
-- =========================================================================
-- RLS is intentionally NOT enabled here. This is a single-user personal portal
-- talking to Supabase via the service-role key from the Next.js server. If you
-- ever expose the portal publicly, add a `user_id` column to every table and
-- enable RLS with `auth.uid() = user_id` policies.
