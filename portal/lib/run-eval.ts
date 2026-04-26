import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { supabaseServer } from './supabase/server';
import { fetchJobDescription } from './fetch-jd';

const REPO_ROOT = path.resolve(process.cwd(), '..');
const MODES_DIR = path.join(REPO_ROOT, 'modes');

// Read the canonical career-ops prompts ONCE per process. They are large and
// don't change between requests, so we cache them and let Anthropic prompt-
// cache the system prompt across calls (saves ~$0.005 per eval after first).
const SYSTEM_PROMPT = (() => {
  const shared = readSafe(path.join(MODES_DIR, '_shared.md'));
  const oferta = readSafe(path.join(MODES_DIR, 'oferta.md'));
  const profile = readSafe(path.join(MODES_DIR, '_profile.md')); // optional user customization
  return [shared, oferta, profile].filter(Boolean).join('\n\n---\n\n');
})();

function readSafe(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

export interface RunEvalResult {
  ok: boolean;
  evaluation_id?: string;
  confidence?: number | null;
  letter_grade?: string | null;
  report_path?: string;
  error?: string;
}

export async function runEval(jobId: string): Promise<RunEvalResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'ANTHROPIC_API_KEY not set in .env.local' };
  }

  const sb = supabaseServer();

  // Fetch job
  const { data: job, error: jobErr } = await sb.from('jobs').select('*').eq('id', jobId).single();
  if (jobErr || !job) {
    return { ok: false, error: `job ${jobId} not found` };
  }

  // Get JD text — prefer raw_jd, else fetch source_url
  let jdText = job.raw_jd as string | null;
  if (!jdText && job.source_url && !job.source_url.startsWith('bijan://')) {
    try {
      jdText = await fetchJobDescription(job.source_url);
    } catch (e) {
      return { ok: false, error: `failed to fetch ${job.source_url}: ${(e as Error).message}` };
    }
  }
  if (!jdText) return { ok: false, error: 'no raw_jd and no fetchable source_url' };

  // Get profile
  const { data: profile, error: profileErr } = await sb
    .from('profile')
    .select('cv_md, goals_md')
    .limit(1)
    .maybeSingle();
  if (profileErr || !profile) return { ok: false, error: 'no profile row found' };

  // Build messages with prompt caching on the (large, stable) system prompt
  const client = new Anthropic({ apiKey });

  const userPrompt = [
    '## Candidate CV',
    profile.cv_md,
    profile.goals_md ? `\n## Goals / preferences\n${profile.goals_md}` : '',
    `\n## Job posting${job.company ? ` — ${job.company}` : ''}${job.title ? ` (${job.title})` : ''}`,
    `Source: ${job.source_url || 'pasted JD'}`,
    '',
    jdText.slice(0, 30_000), // safety cap
    '',
    '---',
    '',
    'Produce the FULL A-G evaluation report in markdown, exactly as oferta.md specifies. Include `**Score:** X/5`, `**Confidence:** NN/100`, and end with the fenced ```bijan-evaluation JSON block.',
  ].join('\n');

  let report: string;
  try {
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });
    report = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
  } catch (e) {
    return { ok: false, error: `Anthropic API: ${(e as Error).message}` };
  }

  // Parse the bijan-evaluation JSON block
  const match = report.match(/```bijan-evaluation\s*\n([\s\S]*?)\n```/);
  let parsed: Record<string, unknown> = {};
  if (match) {
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      // tolerate malformed JSON; we still store the markdown
    }
  }

  // Upload markdown report to Storage
  const slug = (job.company || 'unknown').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const reportPath = `${jobId}/${Date.now()}-${slug}.md`;
  const { error: upErr } = await sb.storage
    .from('reports')
    .upload(reportPath, report, { contentType: 'text/markdown', upsert: true });
  if (upErr) return { ok: false, error: `upload report: ${upErr.message}` };

  // Insert evaluations row
  const confidence = typeof parsed.confidence === 'number' ? Math.round(parsed.confidence) : null;
  const letter = typeof parsed.letter_grade === 'string' ? parsed.letter_grade : null;
  const evalRow = {
    job_id: jobId,
    confidence_score: confidence,
    letter_grade: letter,
    block_a: parsed.block_a ?? null,
    block_b: parsed.block_b ?? null,
    block_c: parsed.block_c ?? null,
    block_d: parsed.block_d ?? null,
    block_e: parsed.block_e ?? null,
    block_f: parsed.block_f ?? null,
    report_md_path: reportPath,
  };
  const { data: ev, error: evErr } = await sb
    .from('evaluations')
    .insert(evalRow)
    .select('id')
    .single();
  if (evErr) return { ok: false, error: `insert evaluation: ${evErr.message}` };

  // Ensure an applications row exists at status=evaluated (if not already)
  await sb
    .from('applications')
    .upsert({ job_id: jobId, status: 'evaluated' }, { onConflict: 'job_id', ignoreDuplicates: true });

  return {
    ok: true,
    evaluation_id: ev.id,
    confidence,
    letter_grade: letter,
    report_path: reportPath,
  };
}
