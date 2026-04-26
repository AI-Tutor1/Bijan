import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function scoreColor(n: number | null | undefined) {
  if (n == null) return 'text-zinc-500';
  if (n >= 80) return 'text-emerald-400';
  if (n >= 60) return 'text-amber-400';
  return 'text-rose-400';
}

export function triageColor(t: string | null | undefined) {
  if (t === 'approve') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (t === 'reject') return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
  if (t === 'manual') return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
  return 'bg-zinc-800 text-zinc-400 border-zinc-700';
}

export function statusColor(s: string | null | undefined) {
  switch (s) {
    case 'applied':
    case 'responded':
      return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    case 'interview':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'offer':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'rejected':
    case 'discarded':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    default:
      return 'bg-zinc-800 text-zinc-400 border-zinc-700';
  }
}
