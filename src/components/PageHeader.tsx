export function PageHeader({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string | undefined }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-foreground">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">{children}</div>;
}
