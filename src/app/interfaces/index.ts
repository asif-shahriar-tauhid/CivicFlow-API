import { Role } from "../../generated/prisma/enums";

export interface IQuery {
  searchTerm?: string;
  page?: string;
  limit?: string;
  sortOrder?: string;
  sortBy?: string;

  [key: string]: any;
}

export interface RequestUser {
  email: string;
  name: string;
  userId: string;
  role: Role;
  departmentId?: string | null;
}

