import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: "admin@teamfwlcons.gg" },
    update: {},
    create: {
      email: "admin@teamfwlcons.gg",
      name: "Admin",
      role: "ADMIN",
    },
  });

  console.log("Created admin user:", admin);

  // Create sample view stats
  const viewStats = await Promise.all([
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

  console.log("Created view stats:", viewStats);

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
