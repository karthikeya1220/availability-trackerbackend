import { PrismaClient } from "@prisma/client";

/**
 * Standard Prisma Client configuration for Supabase / PostgreSQL.
 * We no longer require the Neon-specific WebSocket adapter or DNS shims.
 */
export const prisma = new PrismaClient();
