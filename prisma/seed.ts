import bcrypt from "bcryptjs";
import { Role, UserStatus } from "../src/generated/prisma/enums";
import config from "../src/app/config";
import { prisma } from "../src/app/lib/prisma";

export async function clearAllDatabaseData() {
	console.log("🧹 Clearing all current data from database...");
	await prisma.auditLog.deleteMany({});
	await prisma.notification.deleteMany({});
	await prisma.payment.deleteMany({});
	await prisma.appointment.deleteMany({});
	await prisma.schedule.deleteMany({});
	await prisma.requestFeedback.deleteMany({});
	await prisma.requestSlaAudit.deleteMany({});
	await prisma.requestRoutingAudit.deleteMany({});
	await prisma.requestStatusHistory.deleteMany({});
	await prisma.requestResolution.deleteMany({});
	await prisma.requestInvestigationNote.deleteMany({});
	await prisma.requestAssignment.deleteMany({});
	await prisma.requestAttachment.deleteMany({});
	await prisma.serviceRequest.deleteMany({});
	await prisma.technician.deleteMany({});
	await prisma.citizen.deleteMany({});
	await prisma.user.deleteMany({});
	await prisma.categoryRoutingRule.deleteMany({});
	await prisma.requestCategory.deleteMany({});
	await prisma.department.deleteMany({});
	console.log("✅ Database cleared successfully.");
}

export async function seedAllTables() {
	console.log("🌱 Starting seed: 1 Admin, 5 Staff per department, 1 Citizen...");

	// 1. Wipe existing data
	await clearAllDatabaseData();

	const defaultHashedPassword = await bcrypt.hash(
		"Password@123",
		config.bcrypt_salt_rounds || 10,
	);
	const adminHashedPassword = await bcrypt.hash(
		config.super_admin_password || "Password@123",
		config.bcrypt_salt_rounds || 10,
	);

	// ==========================================
	// 2. DEPARTMENTS
	// ==========================================
	console.log("-> Seeding Departments...");
	const deptDrainage = await prisma.department.create({
		data: {
			id: "09c4b994-4b9e-4099-a0a5-aaeeacc9396f",
			name: "Drainage & Sewerage Department",
			description:
				"Oversees storm water drainage, sewage treatment, canal excavation, and flood prevention.",
			isActive: true,
			isArchived: false,
		},
	});

	const deptElectrical = await prisma.department.create({
		data: {
			id: "7da45ddc-3cf8-4fde-98ba-70c6c862ed42",
			name: "Electrical & Public Lighting Department",
			description:
				"Maintains street lamps, high-mast lighting, distribution junction boxes, and public power safety.",
			isActive: true,
			isArchived: false,
		},
	});

	const deptRoads = await prisma.department.create({
		data: {
			id: "5d673375-4b40-498e-8e61-9deebc59704f",
			name: "Roads & Civil Infrastructure Department",
			description:
				"Responsible for asphalt paving, pothole repairs, footpaths, bridges, and road traffic safety signage.",
			isActive: true,
			isArchived: false,
		},
	});

	const deptSanitation = await prisma.department.create({
		data: {
			id: "141adb23-8e0c-44b1-9e03-d5475af12f71",
			name: "Solid Waste Management Department",
			description:
				"Handles municipal garbage collection, waste transfer stations, landfill logistics, and street sanitation.",
			isActive: true,
			isArchived: false,
		},
	});

	// ==========================================
	// 3. SERVICE CATEGORIES & ROUTING RULES
	// (Required schema for ticket creation & dispatch)
	// ==========================================
	console.log("-> Seeding Request Categories & Routing Rules...");
	const catDrainage = await prisma.requestCategory.create({
		data: {
			id: "935e2322-66bb-48ae-a7dd-d586d49f2f0a",
			name: "Waterlogging & Drainage Choke",
			description:
				"Severe stormwater accumulation, clogged street drains, canal blockages, or manhole overflows.",
			feeAmount: 0,
			feeCurrency: "BDT",
			slaMinutes: 1440,
			isActive: true,
		},
	});

	const catLighting = await prisma.requestCategory.create({
		data: {
			id: "0eda1652-e7e4-4eb5-82cf-c558d96b24dd",
			name: "Broken Streetlight & Dark Corridors",
			description:
				"Non-functional street lamps, flickering illumination, damaged electrical poles, or exposed wires.",
			feeAmount: 0,
			feeCurrency: "BDT",
			slaMinutes: 2880,
			isActive: true,
		},
	});

	const catPothole = await prisma.requestCategory.create({
		data: {
			id: "7d9c6036-95b9-4e3b-84ba-7f5b3c7aeec0",
			name: "Pothole & Pavement Hazard",
			description:
				"Deep craters, fractured asphalt, damaged footpath slabs, or cave-ins threatening road users.",
			feeAmount: 100,
			feeCurrency: "BDT",
			slaMinutes: 4320,
			isActive: true,
		},
	});

	const catWaste = await prisma.requestCategory.create({
		data: {
			id: "74b45c19-7a5f-4917-9ffc-5d009961eecd",
			name: "Illegal Garbage Dumping",
			description:
				"Unauthorized waste heaps, overflowing public dumpsters, medical waste, or dead animal clearance.",
			feeAmount: 50,
			feeCurrency: "BDT",
			slaMinutes: 1440,
			isActive: true,
		},
	});

	const catPermit = await prisma.requestCategory.create({
		data: {
			id: "81e406aa-aa97-49e5-b56e-1bafb74eea24",
			name: "Commercial Construction & Excavation Permit",
			description:
				"Municipal inspection and site utility permit for commercial ground excavation and pipe laying.",
			feeAmount: 500,
			feeCurrency: "BDT",
			slaMinutes: 2880,
			isActive: true,
		},
	});

	const catDemolition = await prisma.requestCategory.create({
		data: {
			id: "77d8c539-1de9-4a74-9f6b-7c7b623a91a7",
			name: "Bulk Demolition & Industrial Waste Haulage",
			description:
				"Specialized transport and dump site disposal fee for heavy rubble and concrete demolition debris.",
			feeAmount: 350,
			feeCurrency: "BDT",
			slaMinutes: 1440,
			isActive: true,
		},
	});

	// Routing rules linking categories to departments
	await prisma.categoryRoutingRule.createMany({
		data: [
			{
				id: "400d84c7-236f-4356-9f23-6854a82f26f5",
				categoryId: catDrainage.id,
				departmentId: deptDrainage.id,
				priority: 1,
				isActive: true,
			},
			{
				id: "9f783bc4-8631-4f5a-be4e-672dbf8b06c6",
				categoryId: catLighting.id,
				departmentId: deptElectrical.id,
				priority: 1,
				isActive: true,
			},
			{
				id: "b23e47b2-80a4-47ba-8c60-f24b389470d5",
				categoryId: catPothole.id,
				departmentId: deptRoads.id,
				priority: 1,
				isActive: true,
			},
			{
				id: "747cf04e-20fd-4578-96f2-d76f187f0925",
				categoryId: catWaste.id,
				departmentId: deptSanitation.id,
				priority: 1,
				isActive: true,
			},
			{
				id: "7a194870-e489-4003-a397-a738ae42d7ca",
				categoryId: catPermit.id,
				departmentId: deptRoads.id,
				priority: 1,
				isActive: true,
			},
			{
				id: "cd4371bf-23c3-45f2-8124-79f24fe179a0",
				categoryId: catDemolition.id,
				departmentId: deptSanitation.id,
				priority: 1,
				isActive: true,
			},
		],
	});

	// ==========================================
	// 4. USERS: 1 ADMIN
	// ==========================================
	console.log("-> Seeding Admin User...");
	const adminEmail = (config.super_admin_email || "superadmin@example.com")
		.trim()
		.toLowerCase();

	const adminUser = await prisma.user.create({
		data: {
			name: config.super_admin_name || "Super Administrator",
			email: adminEmail,
			password: adminHashedPassword,
			role: Role.ADMIN,
			status: UserStatus.ACTIVE,
			emailVerified: true,
		},
	});
	console.log(`   [ADMIN] ${adminUser.email}`);

	// ==========================================
	// 5. USERS: 5 STAFF MEMBERS FOR EACH DEPARTMENT
	// ==========================================
	console.log("-> Seeding 5 Staff Members per Department...");

	const departmentStaffDefinitions = [
		{
			departmentId: deptDrainage.id,
			deptName: "Drainage",
			staffList: [
				{ name: "Engr. Tariqul Islam", email: "staff.drainage.1@civicflow.org" },
				{ name: "Sadia Rahman", email: "staff.drainage.2@civicflow.org" },
				{ name: "Mahmudul Hasan", email: "staff.drainage.3@civicflow.org" },
				{ name: "Farhana Akter", email: "staff.drainage.4@civicflow.org" },
				{ name: "Kamrul Ahsan", email: "staff.drainage.5@civicflow.org" },
			],
		},
		{
			departmentId: deptElectrical.id,
			deptName: "Electrical",
			staffList: [
				{ name: "Fahim Shahriar", email: "staff.electrical.1@civicflow.org" },
				{ name: "Kamal Uddin", email: "staff.electrical.2@civicflow.org" },
				{ name: "Mehedi Hasan", email: "staff.electrical.3@civicflow.org" },
				{ name: "Rashedul Karim", email: "staff.electrical.4@civicflow.org" },
				{ name: "Anika Tabassum", email: "staff.electrical.5@civicflow.org" },
			],
		},
		{
			departmentId: deptRoads.id,
			deptName: "Roads",
			staffList: [
				{ name: "Nusrat Jahan", email: "staff.roads.1@civicflow.org" },
				{ name: "Rafiqul Islam", email: "staff.roads.2@civicflow.org" },
				{ name: "Tanvir Ahmed", email: "staff.roads.3@civicflow.org" },
				{ name: "Shahadat Hossain", email: "staff.roads.4@civicflow.org" },
				{ name: "Bilkis Begum", email: "staff.roads.5@civicflow.org" },
			],
		},
		{
			departmentId: deptSanitation.id,
			deptName: "Solid Waste",
			staffList: [
				{ name: "Zahid Hasan", email: "staff.waste.1@civicflow.org" },
				{ name: "Shirin Sultana", email: "staff.waste.2@civicflow.org" },
				{ name: "Mizanur Rahman", email: "staff.waste.3@civicflow.org" },
				{ name: "Nazmul Huda", email: "staff.waste.4@civicflow.org" },
				{ name: "Parveen Akter", email: "staff.waste.5@civicflow.org" },
			],
		},
	];

	for (const group of departmentStaffDefinitions) {
		console.log(`   Seeding 5 staff for ${group.deptName}...`);
		for (const staff of group.staffList) {
			await prisma.user.create({
				data: {
					name: staff.name,
					email: staff.email,
					password: defaultHashedPassword,
					role: Role.STAFF,
					status: UserStatus.ACTIVE,
					emailVerified: true,
					departmentId: group.departmentId,
				},
			});
			console.log(`     [STAFF] ${staff.email} (${staff.name})`);
		}
	}

	// ==========================================
	// 6. USERS: 1 CITIZEN ACCOUNT
	// ==========================================
	console.log("-> Seeding 1 Citizen Account...");
	const citizenUser = await prisma.user.create({
		data: {
			name: "Sarah Khan",
			email: "citizen@example.com",
			password: defaultHashedPassword,
			role: Role.CITIZEN,
			status: UserStatus.ACTIVE,
			emailVerified: true,
		},
	});

	await prisma.citizen.create({
		data: {
			userId: citizenUser.id,
			name: citizenUser.name,
			email: citizenUser.email,
			contactNumber: "+8801711000001",
			address: "House 12, Road 5, Dhanmondi, Dhaka",
		},
	});
	console.log(`   [CITIZEN] ${citizenUser.email} (Sarah Khan)`);

	console.log("\n🎉 Database Seeding Completed Successfully!");
	console.log("==========================================");
	console.log("Summary of Seeded Credentials:");
	console.log("------------------------------------------");
	console.log(`ADMIN:   ${adminUser.email}  |  Password@123`);
	console.log("STAFF:   (5 per department, all passwords: Password@123)");
	for (const group of departmentStaffDefinitions) {
		console.log(`  - ${group.deptName}:`);
		for (const staff of group.staffList) {
			console.log(`      * ${staff.email}`);
		}
	}
	console.log(`CITIZEN: ${citizenUser.email}  |  Password@123`);
	console.log("==========================================");
}

if (process.argv[1]?.endsWith("seed.ts")) {
	seedAllTables()
		.catch((error) => {
			console.error("❌ Seeding failed:", error);
			process.exitCode = 1;
		})
		.finally(() => prisma.$disconnect());
}
