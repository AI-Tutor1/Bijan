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
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);

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
      setUrl(''); setText(''); setCompany(''); setTitle('');
    } else {
      setMsg({ kind: 'err', text: data.error || `${r.status}` });
    }
  }

  async function submitScreenshot() {
    if (!screenshotFile) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.append('file', screenshotFile);
    const r = await fetch('/api/intake/screenshot', { method: 'POST', body: fd });
    const data = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      const e = data.extracted || {};
      setMsg({
        kind: 'ok',
        text: `Extracted "${e.company || '?'}" — "${e.title || '?'}" (${e.jd_chars || 0} chars). Job id: ${data.id}`,
      });
      router.refresh();
      setScreenshotFile(null);
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
            <CardDescription>
              Drop a LinkedIn / Indeed / careers-page screenshot. Claude Vision will extract company, title, URL, and the full JD text. Requires{' '}
              <code className="text-zinc-400">ANTHROPIC_API_KEY</code> in <code className="text-zinc-400">.env.local</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => setScreenshotFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-zinc-900 hover:file:bg-zinc-200"
            />
            {screenshotFile && (
              <div className="text-xs text-zinc-500">
                {screenshotFile.name} · {Math.round(screenshotFile.size / 1024)} KB
              </div>
            )}
            <Button
              variant="primary"
              disabled={busy || !screenshotFile}
              onClick={submitScreenshot}
            >
              {busy ? 'Extracting…' : 'Extract & save'}
            </Button>
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
