import { listJobs } from '@/lib/queries';
import { JobsTable } from '@/components/jobs-table';


export const dynamic = 'force-dynamic';

export default async function ManualPage() {
  const rows = await listJobs({ triage: 'manual' });
  return (
    <div className="px-8 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-50">Manual</h1>
        <p className="text-sm text-zinc-500">Jobs you'll apply to manually outside the portal.</p>
      </header>
      <JobsTable rows={rows} emptyText="No manual jobs." />
    </div>
  );
}
