import { listJobs } from '@/lib/queries';
import { JobsTable } from '@/components/jobs-table';


export const dynamic = 'force-dynamic';

export default async function ApprovedPage() {
  const rows = await listJobs({ triage: 'approve' });
  return (
    <div className="px-8 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-50">Approved</h1>
        <p className="text-sm text-zinc-500">Jobs you've approved. Run stage-form.mjs to pre-fill the form, then click Submit yourself.</p>
      </header>
      <JobsTable rows={rows} emptyText="No approved jobs yet." />
    </div>
  );
}
