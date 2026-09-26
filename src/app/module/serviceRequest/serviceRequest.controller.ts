import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { RequestUser } from "../../interfaces";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { serviceRequestServices } from "./serviceRequest.service";

const currentUser = (req: Request): RequestUser => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Authentication is required.");
  }
  return req.user;
};

const extractFiles = (req: Request): Express.Multer.File[] | undefined => {
  const files: Express.Multer.File[] = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) {
    files.push(...req.files);
  } else if (req.files && typeof req.files === "object") {
    for (const group of Object.values(req.files)) {
      if (Array.isArray(group)) files.push(...group);
    }
  }
  return files.length > 0 ? files : undefined;
};

const createServiceRequest = catchAsync(async (req: Request, res: Response) => {
  const data = await serviceRequestServices.createServiceRequest(
    req.body,
    currentUser(req),
    extractFiles(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Service request created successfully.",
    data,
  });
});

const listServiceRequests = catchAsync(async (req: Request, res: Response) => {
  const result = await serviceRequestServices.listServiceRequests(
    req.query,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service requests retrieved successfully.",
    ...result,
  });
});

const getServiceRequest = catchAsync(async (req: Request, res: Response) => {
  const data = await serviceRequestServices.getServiceRequest(
    req.params.requestId as string,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service request retrieved successfully.",
    data,
  });
});

const updateServiceRequest = catchAsync(async (req: Request, res: Response) => {
  const data = await serviceRequestServices.updateServiceRequest(
    req.params.requestId as string,
    req.body,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service request updated successfully.",
    data,
  });
});

const deleteServiceRequest = catchAsync(async (req: Request, res: Response) => {
  const data = await serviceRequestServices.deleteServiceRequest(
    req.params.requestId as string,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service request deleted successfully.",
    data,
  });
});

const routeServiceRequest = catchAsync(async (req: Request, res: Response) => {
  const data = await serviceRequestServices.routeServiceRequest(
    req.params.requestId as string,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service request routing evaluated successfully.",
    data,
  });
});

const addAttachment = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError(httpStatus.BAD_REQUEST, "Evidence file is required.");
  }
  const data = await serviceRequestServices.addAttachment(
    req.params.requestId as string,
    req.file,
    req.body?.caption,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Attachment uploaded successfully.",
    data,
  });
});

const listAttachments = catchAsync(async (req: Request, res: Response) => {
  const data = await serviceRequestServices.listAttachments(
    req.params.requestId as string,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attachments retrieved successfully.",
    data,
  });
});

const getAttachment = catchAsync(async (req: Request, res: Response) => {
  const data = await serviceRequestServices.getAttachment(
    req.params.requestId as string,
    req.params.attachmentId as string,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attachment retrieved successfully.",
    data,
  });
});

const deleteAttachment = catchAsync(async (req: Request, res: Response) => {
  const data = await serviceRequestServices.deleteAttachment(
    req.params.requestId as string,
    req.params.attachmentId as string,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attachment deleted successfully.",
    data,
  });
});

const assignServiceRequest = catchAsync(async (req: Request, res: Response) => {
  const data = await serviceRequestServices.assignServiceRequest(
    req.params.requestId as string,
    req.body,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service request assigned successfully.",
    data,
  });
});

const reassignServiceRequest = catchAsync(
  async (req: Request, res: Response) => {
    const data = await serviceRequestServices.reassignServiceRequest(
      req.params.requestId as string,
      req.body,
      currentUser(req),
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Service request reassigned successfully.",
      data,
    });
  },
);

const myQueue = catchAsync(async (req: Request, res: Response) => {
  const result = await serviceRequestServices.getMyQueue(
    req.query,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My work queue retrieved successfully.",
    ...result,
  });
});

const departmentQueue = catchAsync(async (req: Request, res: Response) => {
  const result = await serviceRequestServices.getDepartmentQueue(
    req.query,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Department work queue retrieved successfully.",
    ...result,
  });
});

export const serviceRequestController = {
  createServiceRequest,
  listServiceRequests,
  getServiceRequest,
  updateServiceRequest,
  deleteServiceRequest,
  routeServiceRequest,
  addAttachment,
  listAttachments,
  getAttachment,
  deleteAttachment,
  assignServiceRequest,
  reassignServiceRequest,
  myQueue,
  departmentQueue,
};
