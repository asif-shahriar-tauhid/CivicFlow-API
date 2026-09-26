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
  address?: string;
  ward?: string;
  zone?: string;
  landmark?: string;
  latitude?: number | null;
  longitude?: number | null;
  categoryId?: string;
  citizenId?: string;
}

export interface IUpdateServiceRequestPayload {
  title?: string;
  description?: string;
  caseType?: CaseType;
  priority?: RequestPriority;
  location?: string;
  address?: string | null;
  ward?: string | null;
  zone?: string | null;
  landmark?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  categoryId?: string | null;
  resolutionSummary?: string | null;
}

export interface IServiceRequestQuery {
  searchTerm?: string;
  status?: RequestStatus;
  caseType?: CaseType;
  priority?: RequestPriority;
  categoryId?: string;
  departmentId?: string;
  ward?: string;
  zone?: string;
  assignedToId?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface IAssignmentPayload {
  assignedToId: string;
}

export interface IRequestUser {
  userId: string;
  role: Role;
  departmentId?: string | null;
}

export interface ICreateAttachmentPayload {
  caption?: string;
}
