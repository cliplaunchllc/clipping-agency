import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  // During Next.js build, DATABASE_URL may not be set — return a dummy client
  // that throws only when queries are actually executed at runtime.
  if (!connectionString) {
    return new PrismaClient();
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter } as any);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
