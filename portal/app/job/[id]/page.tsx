import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getJob, getReportMarkdown } from '@/lib/queries';
import { Badge } from '@/components/ui/badge';
import { TriageButtons } from '@/components/triage-buttons';
import { ExternalLink } from 'lucide-react';
import { formatDate, scoreColor, statusColor, triageColor } from '@/lib/utils';


export const dynamic = 'force-dynamic';

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();

  // Normalize: PostgREST returns nested rows as object when FK is unique, array otherwise.
  const pickOne = (x: any) => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));
  const evaluation = pickOne(job.evaluations);
  const application = pickOne(job.applications);
  const reportMd = evaluation ? await getReportMarkdown(evaluation.report_md_path) : null;

  return (
    <div className="px-8 py-6 max-w-5xl">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Back to dashboard
      </Link>

      <header className="mt-3 mb-6 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">
            {job.company || 'Unknown'} <span className="text-zinc-500">·</span>{' '}
            <span className="text-zinc-300">{job.title || 'Untitled role'}</span>
          </h1>
          <div className="mt-2 flex items-center gap-3 text-sm">
            <span className={`font-mono font-semibold ${scoreColor(evaluation?.confidence_score)}`}>
              {evaluation?.confidence_score ?? '—'}/100
            </span>
            {evaluation?.letter_grade && (
              <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700">
                Grade {evaluation.letter_grade}
              </Badge>
            )}
            <Badge className={triageColor(application?.triage)}>
              {application?.triage ?? 'pending'}
            </Badge>
            <Badge className={statusColor(application?.status)}>
              {application?.status ?? 'evaluated'}
            </Badge>
            <span className="text-zinc-500">scanned {formatDate(job.scanned_at)}</span>
          </div>
          {job.source_url && !job.source_url.startsWith('bijan://') && (
            <a
              href={job.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm text-blue-400 hover:underline"
            >
              {job.source_url} <ExternalLink size={12} />
            </a>
          )}
        </div>
      </header>

      <section className="mb-8">
        <TriageButtons jobId={job.id} current={application?.triage ?? null} />
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-6">
        {reportMd ? (
          <div className="prose-bijan max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportMd}</ReactMarkdown>
          </div>
        ) : job.raw_jd ? (
          <div>
            <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">Raw JD</div>
            <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-300">{job.raw_jd}</pre>
          </div>
        ) : (
          <div className="text-sm text-zinc-500">
            No report yet. Run <code className="text-zinc-400">/career-ops oferta</code> on this job
            from the CLI.
          </div>
        )}
      </section>
    </div>
  );
}
