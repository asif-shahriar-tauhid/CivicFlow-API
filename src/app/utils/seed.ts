import bcrypt from "bcryptjs";
import config from "../config";
import { prisma } from "../lib/prisma";

export const seedSuperAdmin = async () => {
  const existing = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });
  if (existing) return;
  await prisma.user.create({
    data: {
      name: config.super_admin_name,
      email: config.super_admin_email,
      password: await bcrypt.hash(
        config.super_admin_password,
        config.bcrypt_salt_rounds,
      ),
      role: "ADMIN",
      emailVerified: true,
    },
  });
};
