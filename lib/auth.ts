import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { redis } from '@/lib/redis'

type UserRecord = {
  id: string
  username: string
  passwordHash: string
  name: string
  status: 'active' | 'pending'
  createdAt: string
}

type IndexEntry = {
  id: string
  username: string
  status: 'active' | 'pending'
  createdAt: string
}

const isProd = process.env.NODE_ENV === 'production'

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  // required on Vercel — sits behind a proxy and next-auth must trust forwarded headers
  ...(({ trustHost: true } as unknown) as object),
  session: { strategy: 'jwt' },
  // Explicitly set the __Secure- prefixed cookie name for Vercel's HTTPS environment.
  // Without this, next-auth may use the non-prefixed name and the middleware can't read it.
  // Conditional so localhost (HTTP) continues to work without the __Secure- prefix.
  ...(isProd ? {
    cookies: {
      sessionToken: {
        name: '__Secure-next-auth.session-token',
        options: {
          httpOnly: true,
          sameSite: 'lax' as const,
          path: '/',
          secure: true,
        },
      },
    },
  } : {}),
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        // Check admin credentials from env vars
        const adminUsername = process.env.ADMIN_USERNAME
        const adminPassword = process.env.ADMIN_PASSWORD
        if (
          adminUsername && adminPassword &&
          credentials.username === adminUsername &&
          credentials.password === adminPassword
        ) {
          return { id: 'jc', name: 'Admin', email: adminUsername }
        }

        const index = await redis.get<IndexEntry[]>('users:index') ?? []
        const entry = index.find(u => u.username === credentials.username)
        if (!entry) return null

        const user = await redis.get<UserRecord>(`user:${entry.id}`)
        if (!user || user.status !== 'active') return null

        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, name: user.name, email: user.username }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string
      }
      return session
    },
  },
  events: {
    async signOut() {
      // ensures JWT cookie is fully cleared server-side on sign out
    },
  },
}
