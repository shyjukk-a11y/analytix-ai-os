'use client';

import clsx from 'clsx';

// Lightweight, CSS-only tooltip (no positioning library, no client state) — a small text bubble
// that appears on hover/focus of its trigger. Used for nav item tips and the per-page "?" help
// link; wraps whatever trigger you give it so it works for icons, text links or buttons alike.
export function Tooltip({
  text,
  children,
  side = 'right',
  className
}: {
  text: string;
  children: React.ReactNode;
  side?: 'right' | 'top' | 'bottom';
  /** Extra classes on the wrapper span. Defaults to inline-flex (sizes to content) — pass
   * "block w-full" when wrapping something that needs to fill its container, e.g. a full-width
   * nav row, so the tooltip wrapper doesn't shrink the row back down to its content width. */
  className?: string;
}) {
  const positionClasses =
    side === 'right'
      ? 'left-full top-1/2 ml-2 -translate-y-1/2'
      : side === 'top'
        ? 'bottom-full left-1/2 mb-2 -translate-x-1/2'
        : 'top-full left-1/2 mt-2 -translate-x-1/2';

  return (
    <span className={className ? clsx('group relative', className) : 'group relative inline-flex'}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-20 whitespace-nowrap rounded-md bg-navy-950 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${positionClasses}`}
      >
        {text}
      </span>
    </span>
  );
}
