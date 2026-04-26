import { listJobs } from '@/lib/queries';
import { JobsTable } from '@/components/jobs-table';


export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const rows = await listJobs({ triage: 'pending' });
  return (
    <div className="px-8 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-50">Inbox</h1>
        <p className="text-sm text-zinc-500">Evaluated jobs awaiting your triage decision.</p>
      </header>
      <JobsTable rows={rows} emptyText="Inbox empty — every evaluated job has been triaged." />
    </div>
  );
}
