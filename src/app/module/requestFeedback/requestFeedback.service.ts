import httpStatus from "http-status";
import { Role } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
  ICreateRequestFeedbackPayload,
  IRequestFeedbackReportQuery,
} from "./requestFeedback.interface";
import type { RequestUser } from "../../interfaces";

const feedbackSelect = {
  id: true,
  requestId: true,
  rating: true,
  comment: true,
  createdAt: true,
  updatedAt: true,
  request: {
    select: {
      id: true,
      requestNumber: true,
      title: true,
      status: true,
      category: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      citizen: { select: { userId: true, name: true, email: true } },
    },
  },
} as const;

const getRequestForUser = async (requestId: string, user: RequestUser) => {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      isDeleted: true,
      citizen: { select: { userId: true } },
    },
  });
  if (!request || request.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "Service request not found.");
  }
  if (user.role === Role.CITIZEN && request.citizen.userId !== user.userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to access this feedback.",
    );
  }
  return request;
};

const submitFeedback = async (
  requestId: string,
  payload: ICreateRequestFeedbackPayload,
  user: RequestUser,
) => {
  if (user.role !== Role.CITIZEN) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only citizens can submit feedback.",
    );
  }
  const request = await getRequestForUser(requestId, user);
  if (request.citizen.userId !== user.userId) {
    throw new AppError(httpStatus.FORBIDDEN, "You do not own this request.");
  }
  if (request.status !== "CLOSED") {
    throw new AppError(
      httpStatus.CONFLICT,
      "Feedback is available only after the request is closed.",
    );
  }
  try {
    return await prisma.requestFeedback.create({
      data: {
        requestId,
        rating: payload.rating,
        comment: payload.comment?.trim() || null,
      },
      select: feedbackSelect,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new AppError(
        httpStatus.CONFLICT,
        "Feedback has already been submitted for this request.",
      );
    }
    throw error;
  }
};

const getMyFeedback = async (requestId: string, user: RequestUser) => {
  await getRequestForUser(requestId, user);
  const feedback = await prisma.requestFeedback.findUnique({
    where: { requestId },
    select: feedbackSelect,
  });
  if (!feedback) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Feedback not found for this request.",
    );
  }
  return feedback;
};

const getReport = async (query: IRequestFeedbackReportQuery) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const where = {
    ...(query.rating ? { rating: query.rating } : {}),
    createdAt: {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    },
    request: {
      isDeleted: false,
      ...(query.status ? { status: query.status } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.searchTerm
        ? {
            OR: [
              {
                requestNumber: {
                  contains: query.searchTerm,
                  mode: "insensitive" as const,
                },
              },
              {
                title: {
                  contains: query.searchTerm,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    },
  };
  const [data, total] = await Promise.all([
    prisma.requestFeedback.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: feedbackSelect,
    }),
    prisma.requestFeedback.count({ where }),
  ]);
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const requestFeedbackService = {
  submitFeedback,
  getMyFeedback,
  getReport,
};
