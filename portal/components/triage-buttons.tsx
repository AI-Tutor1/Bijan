'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import type { Triage } from '@/lib/supabase/types';

export function TriageButtons({ jobId, current }: { jobId: string; current: Triage }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function update(triage: 'approve' | 'reject' | 'manual', body: object = {}) {
    setError(null);
    const res = await fetch(`/api/jobs/${jobId}/triage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triage, ...body }),
    });
    if (!res.ok) {
      const text = await res.text();
      setError(`Update failed: ${res.status} ${text.slice(0, 100)}`);
      return;
    }
    // On Approve, also kick off the stage-form spawn (opens visible Chromium).
    if (triage === 'approve') {
      const sr = await fetch(`/api/jobs/${jobId}/stage`, { method: 'POST' });
      if (!sr.ok) {
        const t = await sr.text();
        setError(`Triage saved, but stage-form failed: ${t.slice(0, 100)}`);
      }
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-zinc-400">
        Current triage:{' '}
        <span className="font-medium text-zinc-200">{current ?? 'pending'}</span>
      </div>
      <div className="flex gap-3">
        <Button
          variant="approve"
          size="lg"
          disabled={pending}
          onClick={() => update('approve')}
        >
          ✓ Approve
        </Button>
        <Button
          variant="reject"
          size="lg"
          disabled={pending}
          onClick={() => setShowRejectDialog(true)}
        >
          ✗ Reject
        </Button>
        <Button
          variant="manual"
          size="lg"
          disabled={pending}
          onClick={() => update('manual')}
        >
          ✋ Manual
        </Button>
      </div>
      {error && <div className="text-sm text-rose-400">{error}</div>}

      {showRejectDialog && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4 space-y-3">
          <div className="text-sm font-medium text-rose-300">Why rejecting?</div>
          <Textarea
            placeholder="One short line — feeds rejection-pattern analysis"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
          />
          <div className="flex gap-2">
            <Button
              variant="reject"
              size="sm"
              disabled={pending}
              onClick={async () => {
                await update('reject', { reason });
                setShowRejectDialog(false);
                setReason('');
              }}
            >
              Confirm Reject
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
