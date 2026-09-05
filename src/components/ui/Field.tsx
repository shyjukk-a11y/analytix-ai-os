import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';
import clsx from 'clsx';

const baseClasses =
  'w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-bluePale';

export function Label({ children, htmlFor, hint }: { children: React.ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
      {children}
      {hint ? <span className="ml-1.5 font-normal text-slate-400">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(baseClasses, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(baseClasses, 'min-h-[84px] resize-y', className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx(baseClasses, className)} {...props} />;
}

export function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>;
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-surface-border py-6 first:pt-0 last:border-b-0">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-blue">{title}</h3>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}
