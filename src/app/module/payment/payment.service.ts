import httpStatus from "http-status";
import { IQuery, RequestUser } from "../../interfaces";
import { number } from "zod";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { PaymentWhereInput } from "../../../generated/prisma/models";

const getMyPayments = async (query: IQuery, user: RequestUser) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const citizen = await prisma.citizen.findUnique({
    where: { userId: user.userId },
  });

  if (!citizen) {
    throw new AppError(httpStatus.NOT_FOUND, "Citizen profile not found.");
  }

  const andConditions: PaymentWhereInput[] = [
    {
      appointment: { citizenId: citizen.id },
    },
  ];

  const payments = await prisma.payment.findMany({
    where: { AND: andConditions },
    take: limit,
    skip,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      appointment: {
        include: {
          technician: {
            select: {
              id: true,
              name: true,
              specialization: true,
            },
          },
          schedule: true,
        },
      },
    },
  });

  const total = await prisma.payment.count({
    where: { AND: andConditions },
  });

  return {
    data: payments,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};



