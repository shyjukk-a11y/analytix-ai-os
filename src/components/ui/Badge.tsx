import clsx from 'clsx';

type Tone = 'neutral' | 'success' | 'warning' | 'caution' | 'critical' | 'brand';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-slate-600',
  success: 'bg-status-successBg text-status-success',
  warning: 'bg-status-warningBg text-status-warning',
  caution: 'bg-status-cautionBg text-status-caution',
  critical: 'bg-status-criticalBg text-status-critical',
  brand: 'bg-brand-bluePale text-brand-blue'
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TONE_CLASSES[tone]
      )}
    >
      {children}
    </span>
  );
}
