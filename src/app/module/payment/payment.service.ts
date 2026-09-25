import httpStatus from "http-status";
import { IQuery, RequestUser } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { PaymentWhereInput } from "../../../generated/prisma/models";
import { Role } from "../../../generated/prisma/enums";

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

const getAllPayments = async (query: IQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: PaymentWhereInput[] = [];

  if (query.citizenEmail) {
    andConditions.push({
      appointment: {
        citizen: {
          email: query.email,
        },
      },
    });
  }

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

const getSinglePayment = async (paymentId: string, user: RequestUser) => {
  const payment = await prisma.payment.findUnique({
    where: {
      id: paymentId,
    },
    include: {
      appointment: {
        include: {
          citizen: {
            select: {
              id: true,
              name: true,
              email: true,
              userId: true,
            },
            technician: {
              select: {
                id: true,
                name: true,
                specialization: true,
              },
            },
          },
          schedule: true,
        },
      },
    },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found.");
  }

  if (user.role === Role.CITIZEN) {
    if (payment.appointment.citizen.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not allowed to view this payment.",
      );
    }
  }
  return payment;
};

export const paymentServices = {
  getAllPayments,
  getMyPayments,
  getSinglePayment,
};
