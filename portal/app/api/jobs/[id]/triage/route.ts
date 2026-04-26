import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import type { Triage } from '@/lib/supabase/types';

const VALID: Triage[] = ['approve', 'reject', 'manual'];

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const triage = body?.triage as Triage | undefined;
  const reason = typeof body?.reason === 'string' ? body.reason : null;

  if (!triage || !VALID.includes(triage)) {
    return NextResponse.json({ error: `Invalid triage. Use one of: ${VALID.join(', ')}` }, { status: 400 });
  }

  const sb = supabaseServer();

  // Map triage → status side-effect rules:
  //   reject → status=discarded
  //   approve / manual → leave status alone (user marks Applied later)
  const update: Record<string, unknown> = { triage };
  if (triage === 'reject') {
    update.status = 'discarded';
    if (reason) update.reject_reason = reason;
  }

  // Upsert: ensure an applications row exists for this job_id (unique).
  const { error: upsertErr } = await sb
    .from('applications')
    .upsert({ job_id: id, ...update }, { onConflict: 'job_id' });

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, triage });
}
