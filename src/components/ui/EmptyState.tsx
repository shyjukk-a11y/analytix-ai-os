export function EmptyState({ icon = '📭', title, description, action }: { icon?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-surface-border bg-surface-muted px-6 py-14 text-center">
      <div className="mb-3 text-3xl">{icon}</div>
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
