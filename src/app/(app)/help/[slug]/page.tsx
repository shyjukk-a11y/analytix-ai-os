import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { NAV_MODULES } from '@/lib/nav-config';
import { HELP_CONTENT } from '@/lib/help-content';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default async function HelpArticlePage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  const mod = NAV_MODULES.find((m) => m.slug === params.slug);
  const article = HELP_CONTENT[params.slug];
  if (!mod || !article) notFound();
  if (mod.requires && !can(session?.user.role, mod.requires)) notFound();

  return (
    <div>
      <PageHeader
        title={`${mod.icon} ${mod.label}`}
        subtitle={mod.description}
        helpSlug={mod.slug}
        actions={
          <>
            {mod.implemented ? (
              <Link href={mod.href} className="self-center text-sm text-brand-blue hover:underline">
                Open {mod.label} →
              </Link>
            ) : null}
            <Link href="/help" className="self-center text-sm text-brand-blue hover:underline">
              ← All help topics
            </Link>
          </>
        }
      />

      <div className="space-y-4">
        <Card>
          <CardBody>
            <h2 className="mb-2 text-sm font-semibold text-navy-950">Overview</h2>
            <p className="text-sm text-slate-600">{article.overview}</p>
          </CardBody>
        </Card>

        {article.howTo.length > 0 ? (
          <Card>
            <CardBody>
              <h2 className="mb-2 text-sm font-semibold text-navy-950">How to use it</h2>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
                {article.howTo.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </CardBody>
          </Card>
        ) : null}

        {article.tips.length > 0 ? (
          <Card>
            <CardBody>
              <h2 className="mb-2 text-sm font-semibold text-navy-950">Tips</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
                {article.tips.map((tip, i) => (
                  <li key={i}>💡 {tip}</li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
