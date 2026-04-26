'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Inbox,
  CheckCircle2,
  XCircle,
  Hand,
  Briefcase,
  Lightbulb,
  User,
  PlusCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/intake', label: 'Intake', icon: PlusCircle },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/approved', label: 'Approved', icon: CheckCircle2 },
  { href: '/rejected', label: 'Rejected', icon: XCircle },
  { href: '/manual', label: 'Manual', icon: Hand },
  { href: '/applied', label: 'Applied', icon: Briefcase },
  { href: '/interview-prep', label: 'Interview Prep', icon: Lightbulb },
  { href: '/profile', label: 'Profile', icon: User },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-56 flex-col border-r border-zinc-800 bg-zinc-950 sticky top-0">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-800">
        <span className="text-lg font-semibold tracking-tight text-zinc-50">Bijan</span>
        <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase text-blue-300">
          portal
        </span>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100',
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-3 text-[11px] text-zinc-600 border-t border-zinc-800">
        single-user · service-role · v0.1
      </div>
    </aside>
  );
}
