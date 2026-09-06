import { prisma } from '@/lib/prisma';

// The fixed set of connector types this registry tracks -- matches nav-config.ts's Integrations
// module description (Odoo, Analytix360, email, WhatsApp) plus a general "Other" slot.
export const DEFAULT_INTEGRATIONS: { type: string; name: string }[] = [
  { type: 'ODOO', name: 'Odoo' },
  { type: 'ANALYTIX360', name: 'Analytix360' },
  { type: 'EMAIL', name: 'Email' },
  { type: 'WHATSAPP', name: 'WhatsApp' }
];

/** Idempotently ensures the fixed connector rows exist (NOT_CONFIGURED by default) so the
 * Integrations page always has something to show without a separate seed step. Uses per-row
 * upserts rather than `createMany({ skipDuplicates: true })` -- SQLite (this project's dev
 * datasource) doesn't support that option, unlike Postgres/MySQL. */
export async function ensureDefaultIntegrations(): Promise<void> {
  await Promise.all(
    DEFAULT_INTEGRATIONS.map((i) =>
      prisma.integration.upsert({
        where: { type: i.type },
        update: {},
        create: i
      })
    )
  );
}
