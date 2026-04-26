import Link from 'next/link';
import { listJobs } from '@/lib/queries';
import type { Status, JobRow } from '@/lib/supabase/types';
import { Badge } from '@/components/ui/badge';
import { scoreColor, formatDate } from '@/lib/utils';


export const dynamic = 'force-dynamic';

const COLUMNS: { key: Status; label: string; color: string }[] = [
  { key: 'applied', label: 'Applied', color: 'border-blue-500/30' },
  { key: 'responded', label: 'Responded', color: 'border-blue-400/30' },
  { key: 'interview', label: 'Interview', color: 'border-amber-500/30' },
  { key: 'offer', label: 'Offer', color: 'border-emerald-500/30' },
  { key: 'rejected', label: 'Rejected', color: 'border-rose-500/30' },
];

export default async function AppliedPage() {
  const all = await listJobs();
  const byStatus = Object.fromEntries(
    COLUMNS.map((c) => [c.key, all.filter((j) => j.status === c.key)]),
  ) as Record<Status, JobRow[]>;

  return (
    <div className="px-8 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-50">Applied — Lifecycle</h1>
        <p className="text-sm text-zinc-500">Jobs that have entered the lifecycle. Update status from each job page.</p>
      </header>
      <div className="grid grid-cols-5 gap-4">
        {COLUMNS.map((col) => (
          <div key={col.key} className={`rounded-lg border ${col.color} bg-zinc-950/50 p-3 min-h-[200px]`}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">{col.label}</span>
              <Badge className="bg-zinc-900 text-zinc-400 border-zinc-700">{byStatus[col.key].length}</Badge>
            </div>
            <div className="space-y-2">
              {byStatus[col.key].map((j) => (
                <Link
                  key={j.id}
                  href={`/job/${j.id}`}
                  className="block rounded-md border border-zinc-800 bg-zinc-900/60 p-2 text-xs hover:border-zinc-700 hover:bg-zinc-900 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-zinc-200 truncate">{j.company || '—'}</span>
                    <span className={`font-mono text-[11px] ${scoreColor(j.confidence_score)}`}>
                      {j.confidence_score ?? '—'}
                    </span>
                  </div>
                  <div className="text-zinc-500 truncate">{j.title || '—'}</div>
                  <div className="mt-1 text-[10px] text-zinc-600">{formatDate(j.scanned_at)}</div>
                </Link>
              ))}
              {byStatus[col.key].length === 0 && (
                <div className="text-[11px] text-zinc-600 italic">empty</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
