import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });

  const { source_type, source_url, company, title, raw_jd } = body;
  if (!source_type) {
    return NextResponse.json({ error: 'source_type required' }, { status: 400 });
  }
  if (!source_url && !raw_jd) {
    return NextResponse.json({ error: 'need source_url or raw_jd' }, { status: 400 });
  }

  const sb = supabaseServer();
  const { data, error } = await sb
    .from('jobs')
    .upsert(
      {
        source_type,
        source_url: source_url || null,
        company: company || null,
        title: title || null,
        raw_jd: raw_jd || null,
      },
      { onConflict: 'source_url' },
    )
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Ensure an applications row exists at status=evaluated, no triage yet.
  await sb
    .from('applications')
    .upsert({ job_id: data.id }, { onConflict: 'job_id', ignoreDuplicates: true });

  return NextResponse.json({ ok: true, id: data.id });
}
