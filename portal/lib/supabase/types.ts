// Hand-written types matching supabase/migrations/0001_initial_schema.sql.
// Keep in sync with the SQL file. If the schema changes, update this too.

export type SourceType = 'api' | 'manual_url' | 'screenshot';
export type Triage = 'approve' | 'reject' | 'manual' | null;
export type Status =
  | 'evaluated'
  | 'applied'
  | 'responded'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'discarded'
  | 'skip';

export interface Job {
  id: string;
  source_type: SourceType;
  source_url: string | null;
  company: string | null;
  title: string | null;
  raw_jd: string | null;
  screenshot_path: string | null;
  scanned_at: string;
}

export interface Evaluation {
  id: string;
  job_id: string;
  confidence_score: number | null;
  letter_grade: string | null;
  report_md_path: string | null;
  evaluated_at: string;
}

export interface Application {
  id: string;
  job_id: string;
  triage: Triage;
  status: Status;
  reject_reason: string | null;
  applied_at: string | null;
  updated_at: string;
}

export interface FormAnswer {
  id: string;
  job_id: string;
  question: string;
  answer: string;
  source: 'report' | 'manual' | 'edited' | null;
}

export interface InterviewQuestion {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  source_job_id: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  cv_md: string;
  goals_md: string | null;
  archetypes: unknown;
  updated_at: string;
}

// Joined row for dashboard table
export interface JobRow {
  id: string;
  company: string | null;
  title: string | null;
  source_url: string | null;
  scanned_at: string;
  confidence_score: number | null;
  letter_grade: string | null;
  triage: Triage;
  status: Status;
}
