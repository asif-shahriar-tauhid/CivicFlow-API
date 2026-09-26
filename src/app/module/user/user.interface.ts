import { Role, UserStatus } from "../../../generated/prisma/enums";

export interface UserQuery {
  page?: number;
  limit?: number;
  searchTerm?: string;
  role?: Role;
  status?: UserStatus;
  departmentId?: string;
}