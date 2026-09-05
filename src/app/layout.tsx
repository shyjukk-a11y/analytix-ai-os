import type { Metadata } from 'next';
import './globals.css';
import { SessionProvider } from '@/components/layout/SessionProvider';

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
