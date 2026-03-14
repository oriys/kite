import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { eq } from 'drizzle-orm'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from './db'
import { users, accounts, sessions, verificationTokens } from './schema'
import { ensureDefaultWorkspace } from './queries/workspaces'
import { DEV_MOCK_AUTH_ENABLED, DEV_MOCK_USERS } from './dev-mock-auth'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    GitHub,
    Google,
    ...(DEV_MOCK_AUTH_ENABLED
      ? [
          Credentials({
            id: 'dev-mock',
            name: 'Local mock user',
            credentials: {
              mockUserId: { label: 'Mock user ID', type: 'text' },
            },
            async authorize(credentials) {
              const mockUserId =
                typeof credentials?.mockUserId === 'string'
                  ? credentials.mockUserId
                  : ''

              if (!mockUserId) {
                return null
              }

              const allowedUser = DEV_MOCK_USERS.find(
                (user) => user.id === mockUserId,
              )
              if (!allowedUser) {
                return null
              }

              const existingUser = await db.query.users.findFirst({
                where: eq(users.id, mockUserId),
              })
              if (!existingUser) {
                return null
              }

              return {
                id: existingUser.id,
                name: existingUser.name,
                email: existingUser.email,
                image: existingUser.image,
              }
            },
          }),
        ]
      : []),
  ],
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      return session
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) {
        await ensureDefaultWorkspace(user.id, user.name ?? 'My Workspace')
      }
    },
  },
})
