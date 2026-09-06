'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_MODULES } from '@/lib/nav-config';
import { Tooltip } from '@/components/ui/Tooltip';

/** Finds the nav module whose href best matches the current route (longest-prefix match, same
 * rule Sidebar uses for "active"), so every page automatically gets a "?" link to its own Help
 * article without every page having to say which one it is. */
function useCurrentHelpSlug(): string | null {
  const pathname = usePathname() ?? '';
  let best: { slug: string; href: string } | null = null;
  for (const mod of NAV_MODULES) {
    if (mod.slug === 'help') continue;
    const matches = pathname === mod.href || pathname.startsWith(mod.href + '/');
    if (matches && (!best || mod.href.length > best.href.length)) {
      best = { slug: mod.slug, href: mod.href };
    }
  }
  return best?.slug ?? null;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  helpSlug
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Override which Help article the "?" link points to. Auto-detected from the current route
   * (matching NAV_MODULES) when omitted — most pages never need to set this. */
  helpSlug?: string;
}) {
  const detectedSlug = useCurrentHelpSlug();
  const slug = helpSlug ?? detectedSlug;

  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-navy-950">{title}</h1>
          {slug ? (
            <Tooltip text="What is this page for? Open the user manual." side="right">
              <Link
                href={`/help/${slug}`}
                aria-label="Help for this page"
                className="flex h-5 w-5 flex-none items-center justify-center rounded-full border border-surface-border text-[11px] font-semibold text-slate-400 hover:border-brand-blue hover:text-brand-blue"
              >
                ?
              </Link>
            </Tooltip>
          ) : null}
        </div>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}
