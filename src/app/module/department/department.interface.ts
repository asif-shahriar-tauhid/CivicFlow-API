export interface ICreateDepartmentPayload {
	name: string;
	description?: string;
}

export interface IUpdateDepartmentPayload {
	name?: string;
	description?: string;
	isActive?: boolean;
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
