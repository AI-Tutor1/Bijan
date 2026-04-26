import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.cv_md !== 'string') {
    return NextResponse.json({ error: 'cv_md (string) required' }, { status: 400 });
  }
  const sb = supabaseServer();

  // Singleton row: read first, then update or insert.
  const { data: existing } = await sb.from('profile').select('id').limit(1).maybeSingle();
  const payload = {
    cv_md: body.cv_md,
    goals_md: typeof body.goals_md === 'string' ? body.goals_md : null,
  };

  if (existing?.id) {
    const { error } = await sb.from('profile').update(payload).eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await sb.from('profile').insert(payload);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Optional: also write to ../cv.md so CLI modes (oferta.md, pdf.md) keep working.
  if (body.export) {
    const cvPath = path.resolve(process.cwd(), '..', 'cv.md');
    try {
      await fs.writeFile(cvPath, body.cv_md, 'utf8');
    } catch (e) {
      return NextResponse.json(
        { error: `DB saved, but failed to write cv.md: ${(e as Error).message}` },
        { status: 500 },
      );
    }
  }
  return NextResponse.json({ ok: true });
}
