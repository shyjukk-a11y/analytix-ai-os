import { ComingSoon } from '@/components/layout/ComingSoon';
import { NAV_MODULES } from '@/lib/nav-config';

export default function Page() {
  const mod = NAV_MODULES.find((m) => m.slug === 'bottlenecks')!;
  return <ComingSoon mod={mod} />;
}
