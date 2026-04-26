import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.question || !body?.answer) {
    return NextResponse.json({ error: 'question and answer required' }, { status: 400 });
  }
  const tags = Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === 'string') : [];
  const sb = supabaseServer();
  const { error } = await sb.from('interview_questions').insert({
    question: body.question,
    answer: body.answer,
    tags,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
