'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';

export function ProfileForm({ initialCv, initialGoals }: { initialCv: string; initialGoals: string }) {
  const [cv, setCv] = useState(initialCv);
  const [goals, setGoals] = useState(initialGoals);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(action: 'save' | 'export') {
    setBusy(true);
    setMsg(null);
    const r = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cv_md: cv, goals_md: goals, export: action === 'export' }),
    });
    setBusy(false);
    if (!r.ok) {
      const t = await r.text();
      setMsg(`Error: ${t.slice(0, 200)}`);
      return;
    }
    setMsg(action === 'export' ? 'Saved + exported to ../cv.md' : 'Saved.');
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-200">CV (markdown)</label>
        <Textarea
          value={cv}
          onChange={(e) => setCv(e.target.value)}
          rows={20}
          className="font-mono text-xs"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-200">Goals / preferences (optional, free-form)</label>
        <Textarea
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          rows={6}
          className="font-mono text-xs"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button variant="primary" disabled={busy} onClick={() => save('save')}>
          {busy ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => save('export')}>
          Save & export to ../cv.md
        </Button>
        {msg && <span className="text-sm text-zinc-400">{msg}</span>}
      </div>
    </div>
  );
}
