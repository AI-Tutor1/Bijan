'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export function EvalButton({ jobId, hasEvaluation }: { jobId: string; hasEvaluation: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/jobs/${jobId}/evaluate`, { method: 'POST' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(data?.error || `${r.status}`);
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="primary" size="sm" disabled={busy || pending} onClick={run}>
        <Sparkles size={14} />
        {busy ? 'Evaluating…' : hasEvaluation ? 'Re-run evaluation' : 'Run evaluation'}
      </Button>
      {err && <span className="text-xs text-rose-400">{err}</span>}
    </div>
  );
}
