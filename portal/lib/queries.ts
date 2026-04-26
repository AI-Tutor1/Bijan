import { supabaseServer } from './supabase/server';
import type { JobRow, Triage, Status } from './supabase/types';

export async function listJobs(filter?: {
  triage?: Triage | 'pending';
  status?: Status;
}): Promise<JobRow[]> {
  const sb = supabaseServer();

  // Pull jobs + latest evaluation + application in one round-trip-ish.
  const { data: jobs, error: jobsErr } = await sb
    .from('jobs')
    .select(
      `
      id,
      company,
      title,
      source_url,
      scanned_at,
      evaluations ( confidence_score, letter_grade ),
      applications ( triage, status )
    `,
    )
    .order('scanned_at', { ascending: false });

  if (jobsErr) throw jobsErr;

  const rows: JobRow[] = (jobs ?? []).map((j: any) => {
    // PostgREST returns nested rows as either an object (when FK is unique)
    // or an array (when multiple matches possible). Normalize to object.
    const pickOne = (x: unknown) => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));
    const ev = pickOne(j.evaluations);
    const app = pickOne(j.applications);
    return {
      id: j.id,
      company: j.company,
      title: j.title,
      source_url: j.source_url,
      scanned_at: j.scanned_at,
      confidence_score: ev?.confidence_score ?? null,
      letter_grade: ev?.letter_grade ?? null,
      triage: (app?.triage ?? null) as Triage,
      status: (app?.status ?? 'evaluated') as Status,
    };
  });

  let filtered = rows;
  if (filter?.triage === 'pending') {
    filtered = filtered.filter((r) => r.triage == null);
  } else if (filter?.triage) {
    filtered = filtered.filter((r) => r.triage === filter.triage);
  }
  if (filter?.status) {
    filtered = filtered.filter((r) => r.status === filter.status);
  }
  return filtered.sort((a, b) => (b.confidence_score ?? -1) - (a.confidence_score ?? -1));
}

export async function getJob(id: string) {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('jobs')
    .select(
      `*,
       evaluations(*),
       applications(*),
       form_answers(*),
       cv_versions(*)`,
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getReportMarkdown(reportPath: string | null): Promise<string | null> {
  if (!reportPath) return null;
  const sb = supabaseServer();
  const { data, error } = await sb.storage.from('reports').download(reportPath);
  if (error) return null;
  return await data.text();
}

export async function listInterviewQuestions(opts?: { search?: string; tag?: string }) {
  const sb = supabaseServer();
  let q = sb.from('interview_questions').select('*').order('created_at', { ascending: false });
  if (opts?.tag) q = q.contains('tags', [opts.tag]);
  if (opts?.search) q = q.or(`question.ilike.%${opts.search}%,answer.ilike.%${opts.search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getProfile() {
  const sb = supabaseServer();
  const { data, error } = await sb.from('profile').select('*').limit(1).maybeSingle();
  if (error) throw error;
  return data;
}
