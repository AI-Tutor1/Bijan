import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseServer } from '@/lib/supabase/server';
import crypto from 'node:crypto';

export const maxDuration = 90;

// POST a multipart/form-data body with a single `file` field (image/png|jpg|webp).
// Pipeline:
//   1. Upload the image to Supabase Storage `screenshots/`.
//   2. Send to Claude Vision (claude-sonnet-4-6) with a structured-extraction
//      prompt → returns {company, title, source_url, raw_jd}.
//   3. Upsert a `jobs` row from the extracted fields.

const EXTRACT_PROMPT = `You are looking at a screenshot of a job posting (likely LinkedIn, Indeed, a company careers page, or similar). Extract:
- company: the hiring company's name
- title: the role / position title
- source_url: the URL of the posting if visible (look in the address bar or the post)
- raw_jd: the full visible job description text — clean it up but keep all substantive content

Respond with ONLY a JSON object:
{"company": "...", "title": "...", "source_url": "..." | null, "raw_jd": "..."}

If you cannot find a field, use null. Do not invent details.`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'multipart "file" field required' }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'file too large (>5MB)' }, { status: 400 });
  }

  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: `unsupported type ${file.type}` }, { status: 400 });
  }

  const sb = supabaseServer();
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const screenshotPath = `${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await sb.storage.from('screenshots').upload(screenshotPath, buf, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: `storage: ${upErr.message}` }, { status: 500 });

  // Send to Claude Vision
  const client = new Anthropic({ apiKey });
  const base64 = buf.toString('base64');

  let extracted: { company?: string; title?: string; source_url?: string | null; raw_jd?: string };
  try {
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: file.type as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', data: base64 } },
            { type: 'text', text: EXTRACT_PROMPT },
          ],
        },
      ],
    });
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    // Extract JSON object even if wrapped in markdown
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No JSON object in response');
    extracted = JSON.parse(m[0]);
  } catch (e) {
    return NextResponse.json(
      { error: `vision extraction failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  if (!extracted.company && !extracted.title) {
    return NextResponse.json(
      { error: 'Vision could not identify a job posting in this image.' },
      { status: 422 },
    );
  }

  // Upsert job — use source_url if extracted, else synthetic
  const synthetic = `bijan://screenshot/${screenshotPath}`;
  const sourceUrl = extracted.source_url || synthetic;
  const { data: job, error: jobErr } = await sb
    .from('jobs')
    .upsert(
      {
        source_type: 'screenshot',
        source_url: sourceUrl,
        company: extracted.company || null,
        title: extracted.title || null,
        raw_jd: extracted.raw_jd || null,
        screenshot_path: screenshotPath,
      },
      { onConflict: 'source_url' },
    )
    .select('id')
    .single();
  if (jobErr) return NextResponse.json({ error: `db: ${jobErr.message}` }, { status: 500 });

  await sb
    .from('applications')
    .upsert({ job_id: job.id }, { onConflict: 'job_id', ignoreDuplicates: true });

  return NextResponse.json({
    ok: true,
    id: job.id,
    extracted: {
      company: extracted.company,
      title: extracted.title,
      source_url: extracted.source_url,
      jd_chars: extracted.raw_jd?.length ?? 0,
    },
  });
}
