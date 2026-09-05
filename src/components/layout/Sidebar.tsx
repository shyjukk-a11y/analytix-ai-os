'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { NAV_MODULES } from '@/lib/nav-config';
import { can, type Permission, ROLE_LABELS } from '@/lib/rbac';
import type { Role } from '@prisma/client';
import { signOut } from 'next-auth/react';

export function Sidebar({ userRole, userName }: { userRole: Role; userName: string }) {
  const pathname = usePathname();

  const visibleModules = NAV_MODULES.filter((m) => !m.requires || can(userRole, m.requires as Permission));

  return (
    <aside className="flex h-screen w-72 flex-none flex-col overflow-y-auto border-r border-navy-700/40 bg-gradient-to-b from-navy-950 to-navy-900 text-slate-200">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="text-lg font-bold text-white">Analytix</div>
        <div className="text-[11px] uppercase tracking-wide text-slate-400">AI Business Transformation OS</div>
      </div>

      <div className="border-b border-white/10 px-5 py-3">
        <div className="text-sm font-semibold text-white">{userName}</div>
        <div className="text-xs text-slate-400">{ROLE_LABELS[userRole]}</div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-3">
        {visibleModules.map((mod) => {
          const active = pathname === mod.href || pathname?.startsWith(mod.href + '/');
          return (
            <Link
              key={mod.slug}
              href={mod.implemented ? mod.href : `${mod.href}`}
              className={clsx(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                active ? 'bg-brand-blue/20 font-semibold text-white' : 'text-slate-300 hover:bg-white/5'
              )}
            >
              <span className="w-5 flex-none text-center">{mod.icon}</span>
              <span className="flex-1">{mod.label}</span>
              {!mod.implemented ? (
                <span className="flex-none rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">
                  P{mod.phase}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/5"
        >
          ↩ Sign out
        </button>
      </div>
    </aside>
  );
}
