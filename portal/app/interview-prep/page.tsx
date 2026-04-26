import { listInterviewQuestions } from '@/lib/queries';
import { Badge } from '@/components/ui/badge';
import { AddQuestionDialog } from './add-dialog';


export const dynamic = 'force-dynamic';

export default async function InterviewPrepPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const sp = await searchParams;
  const rows = await listInterviewQuestions({ search: sp.q, tag: sp.tag });
  const allTags = Array.from(new Set(rows.flatMap((r) => r.tags))).sort();

  return (
    <div className="px-8 py-6 max-w-4xl">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Interview Prep</h1>
          <p className="text-sm text-zinc-500">Question bank · {rows.length} entries</p>
        </div>
        <AddQuestionDialog />
      </header>

      <form action="" method="get" className="mb-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={sp.q || ''}
          placeholder="Search questions or answers..."
          className="flex h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        />
        {sp.tag && <input type="hidden" name="tag" value={sp.tag} />}
        <button className="h-9 rounded-md bg-zinc-100 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-200">Search</button>
      </form>

      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5 text-xs">
          <span className="text-zinc-500 mr-1">tags:</span>
          {allTags.map((t) => (
            <a
              key={t}
              href={sp.tag === t ? `?${sp.q ? `q=${sp.q}` : ''}` : `?tag=${t}${sp.q ? `&q=${sp.q}` : ''}`}
              className={
                sp.tag === t
                  ? 'rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-blue-300'
                  : 'rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-zinc-400 hover:bg-zinc-800'
              }
            >
              {t}
            </a>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/50 px-6 py-16 text-center text-sm text-zinc-500">
            No questions yet. Add one manually, or run <code>node scripts/sync-question-bank.mjs</code> after a prep session.
          </div>
        ) : (
          rows.map((q) => (
            <details
              key={q.id}
              className="group rounded-lg border border-zinc-800 bg-zinc-950/50 transition open:bg-zinc-950"
            >
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-zinc-200 hover:text-zinc-50">
                <div className="flex items-start justify-between gap-3">
                  <span>{q.question}</span>
                  <span className="text-xs text-zinc-500 group-open:rotate-90 transition-transform">▶</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {q.tags.map((t: string) => (
                    <Badge key={t} className="bg-zinc-900 text-zinc-400 border-zinc-700 text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              </summary>
              <div className="border-t border-zinc-800 px-4 py-3 text-sm text-zinc-300 whitespace-pre-wrap">
                {q.answer}
              </div>
            </details>
          ))
        )}
      </div>
    </div>
  );
}
