import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Connect to the database and run any seed logic.
async function main() {
  await prisma.$connect();
}

// Ensure the process exits cleanly and the client disconnects.
main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
