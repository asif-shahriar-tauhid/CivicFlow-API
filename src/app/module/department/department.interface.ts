export interface ICreateDepartmentPayload {
  name: string;
  description?: string;
}

export interface ICreateRoutingRulePayload {
  categoryId: string;
  departmentId: string;
  location?: string;
  priority?: number;
}

export interface IDepartmentQuery {
  includeArchived?: string;
}

export interface IAssignStaffDepartmentPayload {
  departmentId: string | null;
}
