import type {
  CaseType,
  RequestPriority,
  RequestStatus,
  Role,
} from "../../../generated/prisma/enums";

export interface ICreateServiceRequestPayload {
  title: string;
  description: string;
  caseType?: CaseType;
  priority?: RequestPriority;
  location?: string;
  department?: string;
  categoryId?: string;
  citizenId?: string;
}

export interface IUpdateServiceRequestPayload {
  title?: string;
  description?: string;
  caseType?: CaseType;
  status?: RequestStatus;
  priority?: RequestPriority;
  location?: string;
  department?: string;
  categoryId?: string | null;
  resolutionSummary?: string | null;
}

export interface IServiceRequestQuery {
  searchTerm?: string;
  status?: RequestStatus;
  caseType?: CaseType;
  priority?: RequestPriority;
  categoryId?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface IRequestUser {
  userId: string;
  role: Role;
}
