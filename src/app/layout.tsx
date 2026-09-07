import type { Metadata } from 'next';
import './globals.css';
import { SessionProvider } from '@/components/layout/SessionProvider';

// This app is entirely auth- and database-backed — every route depends on the request
// (session cookie, DB reads), so nothing should be statically prerendered at build time.
// Forcing dynamic also avoids build-time evaluation of request-only config like NEXTAUTH_URL.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Analytix AI Business Transformation OS',
  description: 'Discover Work → Capture Knowledge → Improve Processes → Build AI → Measure Impact'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
