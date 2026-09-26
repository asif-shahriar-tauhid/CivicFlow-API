import type {
  RequestStatus,
  SlaEscalationState,
} from "../../../generated/prisma/enums";

export interface ISlaQuery {
  departmentId?: string;
  categoryId?: string;
  page?: string;
  limit?: string;
}

export interface ISlaConfigPayload {
  slaMinutes: number;
}

export interface ISlaRequestSummary {
  id: string;
  requestNumber: string;
  title: string;
  status: RequestStatus;
  slaDueAt: Date | null;
  slaPausedAt: Date | null;
  slaPausedDurationSeconds: number;
  slaBreachedAt: Date | null;
  slaEscalationState: SlaEscalationState;
  department: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
}
