import type { AuthOptions } from 'next-auth';
import type { Role } from '@/lib/enums';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

/**
 * Phase 1 auth: credentials (email + password) backed by Prisma, with seeded demo users
 * for every role in spec section 3. Architecture-wise this is where a later phase swaps in
 * a real enterprise IdP (Azure AD / Okta / Google Workspace via next-auth's OAuth/OIDC
 * providers) without touching anything downstream of `getServerAuthSession()`.
 */
export const authOptions: AuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login'
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user || !user.active) return null;

        const validPassword = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!validPassword) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          // Prisma stores role as a plain String (SQLite has no native enum) but everywhere else
          // in the app (assertCan/can, session.user.role) treats it as the Role union declared in
          // src/types/next-auth.d.ts. Safe to assert here: every row is written through
          // createUser/seed.ts, both of which only ever store one of the Role enum's values.
          role: user.role as Role
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    }
  }
};
