import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@example.com";
  const passwordHash = await hashPassword("demo12345");
  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash
    },
    create: {
      email,
      name: "Demo Researcher",
      passwordHash
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
