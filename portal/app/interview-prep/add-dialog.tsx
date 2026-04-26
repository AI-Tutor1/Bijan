'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Plus } from 'lucide-react';

export function AddQuestionDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    const r = await fetch('/api/interview-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, answer, tags }),
    });
    if (!r.ok) {
      const t = await r.text();
      setErr(t.slice(0, 200));
      return;
    }
    setOpen(false);
    setQuestion(''); setAnswer(''); setTagsInput('');
    startTransition(() => router.refresh());
  }

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <Plus size={14} /> Add question
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-zinc-50">Add question</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400">Question</label>
                <Input value={question} onChange={(e) => setQuestion(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Answer (STAR+R or notes)</label>
                <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={6} />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Tags (comma-separated)</label>
                <Input
                  placeholder="behavioral, leadership, story-bank"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                />
              </div>
              {err && <div className="text-xs text-rose-400">{err}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                <Button variant="primary" size="sm" disabled={pending || !question || !answer} onClick={save}>
                  {pending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
