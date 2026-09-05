'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Field';
import { ROLE_LABELS } from '@/lib/rbac';

// Demo accounts seeded by `npm run db:seed` — see README for the full table.
// Shown directly on the login screen so reviewers can sign in as any role without digging
// through docs; remove this block before this ever points at a non-demo database.
const DEMO_ACCOUNTS: { role: string; email: string }[] = [
  { role: ROLE_LABELS.ADMINISTRATOR, email: 'admin@analytix.demo' },
  { role: ROLE_LABELS.MANAGEMENT_CEO, email: 'ceo@analytix.demo' },
  { role: ROLE_LABELS.DEPARTMENT_HEAD, email: 'depthead@analytix.demo' },
  { role: ROLE_LABELS.PROCESS_OWNER, email: 'processowner@analytix.demo' },
  { role: ROLE_LABELS.EMPLOYEE, email: 'employee@analytix.demo' },
  { role: ROLE_LABELS.AI_TRANSFORMATION_COMMITTEE, email: 'committee@analytix.demo' },
  { role: ROLE_LABELS.TECHNOLOGY_TEAM, email: 'tech@analytix.demo' },
  { role: ROLE_LABELS.INFORMATION_SECURITY, email: 'infosec@analytix.demo' },
  { role: ROLE_LABELS.LEGAL_COMPLIANCE_REVIEWER, email: 'legal@analytix.demo' }
];
const DEMO_PASSWORD = 'Passw0rd!';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@analytix.demo');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      setError('Invalid email or password.');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 to-navy-800 px-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-card bg-white shadow-cardLg md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-navy-950 p-8 text-slate-200 md:flex">
          <div>
            <div className="text-xl font-bold text-white">Analytix</div>
            <div className="text-xs uppercase tracking-wide text-slate-400">AI Business Transformation OS</div>
          </div>
          <div>
            <p className="text-sm leading-relaxed text-slate-300">
              Discover Work → Capture Knowledge → Improve Processes → Build AI → Measure Impact
            </p>
            <p className="mt-4 text-xs text-slate-500">Phase 1 — Foundation build. Demo data only.</p>
          </div>
        </div>

        <div className="p-8">
          <h1 className="text-lg font-bold text-navy-950">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Use a demo account below, or your own credentials.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error ? <p className="text-sm text-status-critical">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-6 border-t border-surface-border pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Demo accounts (password: {DEMO_PASSWORD})</p>
            <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto text-xs">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(DEMO_PASSWORD);
                  }}
                  className="flex justify-between rounded px-2 py-1 text-left hover:bg-surface-muted"
                >
                  <span className="text-slate-600">{acc.role}</span>
                  <span className="text-slate-400">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
