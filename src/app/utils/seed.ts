import bcrypt from "bcryptjs";
import config from "../config";
import { prisma } from "../lib/prisma";

export const seedSuperAdmin = async () => {
  const email = config.super_admin_email.trim().toLowerCase();
  const password = await bcrypt.hash(
    config.super_admin_password,
    config.bcrypt_salt_rounds,
  );

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name: config.super_admin_name,
      password,
      role: "ADMIN",
      status: "ACTIVE",
      emailVerified: true,
      isDeleted: false,
      deletedAt: null,
    },
    create: {
      name: config.super_admin_name,
      email,
      password,
      role: "ADMIN",
      status: "ACTIVE",
      emailVerified: true,
    },
  });

  console.log(`Admin account ready: ${admin.email}`);
};

if (process.argv[1]?.endsWith("seed.ts")) {
  seedSuperAdmin()
    .catch((error) => {
      console.error("Failed to seed admin account:", error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
