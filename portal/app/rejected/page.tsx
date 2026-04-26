import { listJobs } from '@/lib/queries';
import { JobsTable } from '@/components/jobs-table';


export const dynamic = 'force-dynamic';

export default async function RejectedPage() {
  const rows = await listJobs({ triage: 'reject' });
  return (
    <div className="px-8 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-50">Rejected</h1>
        <p className="text-sm text-zinc-500">Jobs you've passed on. Reasons feed rejection-pattern analysis.</p>
      </header>
      <JobsTable rows={rows} emptyText="No rejected jobs yet." />
    </div>
  );
}
