import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Sidebar } from '@/components/layout/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <div className="flex h-screen bg-surface-muted">
      <Sidebar userRole={session.user.role} userName={session.user.name} />
      <main className="flex-1 overflow-y-auto px-8 py-7">{children}</main>
    </div>
  );
}
