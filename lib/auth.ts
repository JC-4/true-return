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

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
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
}
