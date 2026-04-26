import Link from 'next/link';
import type { JobRow } from '@/lib/supabase/types';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate, scoreColor, statusColor, triageColor } from '@/lib/utils';

export function JobsTable({ rows, emptyText = 'No jobs to show.' }: { rows: JobRow[]; emptyText?: string }) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/50 px-6 py-16 text-center text-sm text-zinc-500">
        {emptyText}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900 text-zinc-400">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Score</th>
            <th className="px-4 py-2 text-left font-medium">Company</th>
            <th className="px-4 py-2 text-left font-medium">Title</th>
            <th className="px-4 py-2 text-left font-medium">Triage</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
            <th className="px-4 py-2 text-left font-medium">Scanned</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.map((j) => (
            <tr key={j.id} className="bg-zinc-950 hover:bg-zinc-900/70 transition-colors">
              <td className="px-4 py-3">
                <Link
                  href={`/job/${j.id}`}
                  className={cn('font-mono font-semibold tabular-nums', scoreColor(j.confidence_score))}
                >
                  {j.confidence_score ?? '—'}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Link href={`/job/${j.id}`} className="text-zinc-100 hover:underline">
                  {j.company || '—'}
                </Link>
              </td>
              <td className="px-4 py-3 text-zinc-300">{j.title || '—'}</td>
              <td className="px-4 py-3">
                <Badge className={triageColor(j.triage)}>{j.triage ?? 'pending'}</Badge>
              </td>
              <td className="px-4 py-3">
                <Badge className={statusColor(j.status)}>{j.status}</Badge>
              </td>
              <td className="px-4 py-3 text-zinc-500">{formatDate(j.scanned_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
