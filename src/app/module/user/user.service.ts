import type { UploadApiResponse } from "cloudinary";
import type { Prisma } from "../../../generated/prisma/client";
import { type Role, UserStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { cloudinary } from "../../lib/cloudinary";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
import { UserQuery } from "./user.interface";

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
  const currentUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      imagePublicId: true,
      imageUrl: true,
    },
  });

  const cloudinaryResult = await new Promise<UploadApiResponse>(
    (resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: "auto",
          },

          async (error, result) => {
            if (error) return reject(error);
            if (!result)
              return reject(
                new AppError(
                  httpStatus.NOT_FOUND,
                  "No result returned from Cloudinary.",
                ),
              );
            resolve(result);
          },
        )
        .end(buffer);
    },
  );

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },

    data: {
      imageUrl: cloudinaryResult.secure_url,
      imagePublicId: cloudinaryResult.public_id,
    },
    omit: {
      password: true,
    },
  });

  if (currentUser?.imagePublicId && currentUser.imageUrl) {
    await cloudinary.uploader.destroy(currentUser.imagePublicId);
  }

  return updatedUser;
};

const getAllUsers = async (query: UserQuery) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const conditions: Prisma.UserWhereInput[] = [];

  if (query.searchTerm) {
    conditions.push({
      OR: [
        { name: { contains: query.searchTerm, mode: "insensitive" } },
        { email: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }
  if (query.role) conditions.push({ role: query.role });
  if (query.status) conditions.push({ status: query.status });
  if (query.departmentId) conditions.push({ departmentId: query.departmentId });

  const where: Prisma.UserWhereInput =
    conditions.length > 0 ? { AND: conditions } : {};

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
        imageUrl: true,
        emailVerified: true,
        isDeleted: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
      imageUrl: true,
      emailVerified: true,
      isDeleted: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found.");
  }
  return user;
};

const updateUser = async (
  userId: string,
  payload: {
    role?: Role;
    status?: UserStatus;
    departmentId?: string | null;
    name?: string;
  },
) => {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!existingUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found.");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(payload.role ? { role: payload.role } : {}),
      ...(payload.status ? { status: payload.status } : {}),
      ...(payload.departmentId !== undefined
        ? { departmentId: payload.departmentId }
        : {}),
      ...(payload.name ? { name: payload.name } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      departmentId: true,
      imageUrl: true,
      isDeleted: true,
      updatedAt: true,
    },
  });

  return { before: existingUser, after: updated };
};

const softDeleteUser = async (userId: string) => {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!existingUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found.");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      status: UserStatus.BLOCKED,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      isDeleted: true,
      deletedAt: true,
    },
  });

  return { before: existingUser, after: updated };
};

export const UserServices = {
  uploadProfileImage,
  getAllUsers,
  getUserById,
  updateUser,
  softDeleteUser,
};
