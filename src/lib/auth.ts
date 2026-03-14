import NextAuth, { type Session, type User } from 'next-auth';
import type { JWT } from '@auth/core/jwt';
import type { AdapterUser } from '@auth/core/adapters';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/db';
import type { UserRole } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      businessId: string | null;
    };
  }
  interface User {
    role: UserRole;
    businessId: string | null;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    role: UserRole;
    businessId: string | null;
  }
}

export const authConfig = {
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials): Promise<{
        id: string;
        email: string;
        name: string;
        role: UserRole;
        businessId: string | null;
      } | null> {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        const valid = await compare(credentials.password as string, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          businessId: user.businessId ?? null,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' as const },
  pages: { signIn: '/login' },
  callbacks: {
    
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role;
        session.user.businessId = token.businessId;
      }
      return session;
    },
    async jwt({ token, user, trigger }: { token: JWT; user: User | AdapterUser; trigger?: string }) {
      if (user) {
        token.role = (user as { role: UserRole }).role;
        token.businessId = (user as { businessId: string | null }).businessId;
        token.sub = (user as { id: string }).id;
      }
      // On every token refresh, re-fetch from DB to keep businessId fresh
      if (!user && token.sub) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { role: true, businessId: true },
          });
          if (dbUser) {
            token.role = dbUser.role;
            token.businessId = dbUser.businessId ?? null;
          }
        } catch {
          // DB unavailable — use cached token values
        }
      }
      return token;
    },
    async authorized({ auth }: { auth: Session | null }) {
      return !!auth?.user;
    },
  },
};

const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export { handlers, auth, signIn, signOut };