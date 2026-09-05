import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-brand-blue text-white hover:bg-brand-blueLight',
  secondary: 'border border-surface-border bg-white text-slate-700 hover:bg-surface-muted',
  ghost: 'text-slate-500 hover:bg-surface-muted'
};

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}
