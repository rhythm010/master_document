import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export const prisma = new PrismaClient();

export type DbClient = PrismaClient | Prisma.TransactionClient;
