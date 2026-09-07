/** @type {import('next').NextConfig} */

// NextAuth (v4) reads process.env.NEXTAUTH_URL at module load and does `new URL(...)` on it.
// If it's unset or blank at build time — which it is on a fresh Vercel project — that throws
// "Invalid URL" and fails the build. Derive a sane value from the vars Vercel always provides,
// so the deploy works with zero manual config; an explicit NEXTAUTH_URL still wins.
function resolveNextAuthUrl() {
  const explicit = process.env.NEXTAUTH_URL;
  if (explicit && /^https?:\/\//.test(explicit)) return explicit;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (host) return `https://${host}`;
  return 'http://localhost:3000';
}

const nextConfig = {
  env: {
    NEXTAUTH_URL: resolveNextAuthUrl()
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb'
    }
  }
};

export default nextConfig;
