import { NextResponse } from 'next/server';
import { runEval } from '@/lib/run-eval';

export const maxDuration = 300; // 5 minutes — eval can be slow

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const result = await runEval(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}
