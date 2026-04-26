import { listJobs } from '@/lib/queries';
import { JobsTable } from '@/components/jobs-table';


export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const rows = await listJobs();
  const stats = {
    total: rows.length,
    pending: rows.filter((r) => r.triage == null && r.status === 'evaluated').length,
    approved: rows.filter((r) => r.triage === 'approve').length,
    applied: rows.filter((r) => r.status === 'applied').length,
  };
  return (
    <div className="px-8 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-50">Dashboard</h1>
        <p className="text-sm text-zinc-500">All evaluated jobs, ranked by confidence score.</p>
      </header>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Stat label="Total" value={stats.total} />
        <Stat label="Pending triage" value={stats.pending} accent="text-amber-300" />
        <Stat label="Approved" value={stats.approved} accent="text-emerald-300" />
        <Stat label="Applied" value={stats.applied} accent="text-blue-300" />
      </div>
      <JobsTable rows={rows} emptyText="No jobs yet. Add one via Intake →" />
    </div>
  );
}

function Stat({ label, value, accent = 'text-zinc-100' }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`text-2xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}
