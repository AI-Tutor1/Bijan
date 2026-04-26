'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function IntakePage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function submit(payload: object) {
    setBusy(true);
    setMsg(null);
    const r = await fetch('/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      setMsg({ kind: 'ok', text: `Saved. Job id: ${data.id}` });
      router.refresh();
      // Reset form
      setUrl(''); setText(''); setCompany(''); setTitle('');
    } else {
      setMsg({ kind: 'err', text: data.error || `${r.status}` });
    }
  }

  return (
    <div className="px-8 py-6 max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-50">Intake a job</h1>
        <p className="text-sm text-zinc-500">
          Drop a URL, paste a JD, or upload a screenshot. Evaluation is run separately via{' '}
          <code className="text-zinc-400">/career-ops oferta &lt;url&gt;</code> in the CLI for now.
        </p>
      </header>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>1. URL</CardTitle>
            <CardDescription>Greenhouse / Ashby / Lever / Workday / company careers page</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="https://boards.greenhouse.io/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Button
                variant="primary"
                disabled={busy || !url}
                onClick={() => submit({ source_type: 'manual_url', source_url: url })}
              >
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Paste raw JD</CardTitle>
            <CardDescription>For postings without a public URL (recruiter emails, internal listings)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
              <Input placeholder="Role title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <Textarea
              placeholder="Paste the full job description here..."
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button
              variant="primary"
              disabled={busy || !text || !company}
              onClick={() => submit({ source_type: 'manual_url', company, title, raw_jd: text })}
            >
              Save
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Screenshot</CardTitle>
            <CardDescription>Drag-drop a LinkedIn / Indeed screenshot — extract via Claude Vision (coming Phase 7)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-dashed border-zinc-700 bg-zinc-900/30 px-4 py-8 text-center text-sm text-zinc-600">
              Screenshot upload — coming in Phase 7 (Claude Vision wiring)
            </div>
          </CardContent>
        </Card>

        {msg && (
          <div
            className={
              msg.kind === 'ok'
                ? 'rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300'
                : 'rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300'
            }
          >
            {msg.text}
          </div>
        )}
      </div>
    </div>
  );
}
