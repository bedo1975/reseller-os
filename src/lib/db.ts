import { PrismaClient } from '@prisma/client'

// Cache key bumped when the Prisma schema changes (new models/fields) so the
// dev server picks up the regenerated client instead of reusing an outdated
// PrismaClient instance stored in globalThis.
const PRISMA_CACHE_VERSION = 'v2-users'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  prismaVersion?: string
}

export const db =
  (globalForPrisma.prisma && globalForPrisma.prismaVersion === PRISMA_CACHE_VERSION)
    ? globalForPrisma.prisma
    : new PrismaClient({ log: ['query'] })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
  globalForPrisma.prismaVersion = PRISMA_CACHE_VERSION
}
