import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("admin123456", 10);

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash,
      email: "admin@teamfwlcons.gg",
      name: "Admin",
      role: "ADMIN",
    },
  });

  console.log("Created admin user:", admin.username);

  await Promise.all([
    prisma.viewStat.upsert({
      where: { slug_locale: { slug: "2026-08-01-welcome", locale: "zh" } },
      update: {},
      create: {
        slug: "2026-08-01-welcome",
        locale: "zh",
        views: 42,
      },
    }),
    prisma.viewStat.upsert({
      where: { slug_locale: { slug: "2026-08-01-welcome", locale: "en" } },
      update: {},
      create: {
        slug: "2026-08-01-welcome",
        locale: "en",
        views: 18,
      },
    }),
  ]);

  console.log("Database seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
