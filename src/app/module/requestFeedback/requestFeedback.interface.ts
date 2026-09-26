import type { RequestStatus } from "../../../generated/prisma/enums";

export interface ICreateRequestFeedbackPayload {
  rating: number;
  comment?: string;
}

export interface IRequestFeedbackReportQuery {
  rating?: number;
  status?: RequestStatus;
  categoryId?: string;
  departmentId?: string;
  from?: string;
  to?: string;
  searchTerm?: string;
  page?: string;
  limit?: string;
}
