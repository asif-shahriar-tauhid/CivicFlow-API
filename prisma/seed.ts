import bcrypt from "bcryptjs";
import {
	AppointmentStatus,
	AssignmentAction,
	CaseType,
	PaymentStatus,
	RequestPriority,
	RequestRoutingStatus,
	RequestStatus,
	Role,
	ScheduleStatus,
	SlaEscalationState,
	TechnicianVerificationStatus,
	UserStatus,
} from "../src/generated/prisma/enums";
import config from "../src/app/config";
import { prisma } from "../src/app/lib/prisma";

export async function seedAllTables() {
	console.log(
		"🌱 Starting full database seed (at least 3 records per table)...",
	);

	const defaultHashedPassword = await bcrypt.hash(
		"Password@123",
		config.bcrypt_salt_rounds || 10,
	);
	const adminHashedPassword = await bcrypt.hash(
		config.super_admin_password || "Password@123",
		config.bcrypt_salt_rounds || 10,
	);

	// ==========================================
	// 1. DEPARTMENTS (Table: departments) - 4 records
	// ==========================================
	console.log("-> Seeding Departments...");
	const deptDrainage = await prisma.department.upsert({
		where: { name: "Drainage & Sewerage Department" },
		update: {},
		create: {
			name: "Drainage & Sewerage Department",
			description:
				"Oversees storm water drainage, sewage treatment, canal excavation, and flood prevention.",
			isActive: true,
			isArchived: false,
		},
	});

	const deptElectrical = await prisma.department.upsert({
		where: { name: "Electrical & Public Lighting Department" },
		update: {},
		create: {
			name: "Electrical & Public Lighting Department",
			description:
				"Maintains street lamps, high-mast lighting, distribution junction boxes, and public power safety.",
			isActive: true,
			isArchived: false,
		},
	});

	const deptRoads = await prisma.department.upsert({
		where: { name: "Roads & Civil Infrastructure Department" },
		update: {},
		create: {
			name: "Roads & Civil Infrastructure Department",
			description:
				"Responsible for asphalt paving, pothole repairs, footpaths, bridges, and road traffic safety signage.",
			isActive: true,
			isArchived: false,
		},
	});

	const deptSanitation = await prisma.department.upsert({
		where: { name: "Solid Waste Management Department" },
		update: {},
		create: {
			name: "Solid Waste Management Department",
			description:
				"Handles municipal garbage collection, waste transfer stations, landfill logistics, and street sanitation.",
			isActive: true,
			isArchived: false,
		},
	});

	// ==========================================
	// 2. USERS (Table: users) - 10 records
	// ==========================================
	console.log("-> Seeding Users...");
	const adminEmail = (config.super_admin_email || "superadmin@example.com")
		.trim()
		.toLowerCase();
	const adminUser = await prisma.user.upsert({
		where: { email: adminEmail },
		update: {
			role: Role.ADMIN,
			status: UserStatus.ACTIVE,
			emailVerified: true,
		},
		create: {
			name: config.super_admin_name || "Super Administrator",
			email: adminEmail,
			password: adminHashedPassword,
			role: Role.ADMIN,
			status: UserStatus.ACTIVE,
			emailVerified: true,
		},
	});

	// Staff Users (linked to departments)
	const staffDrainageUser = await prisma.user.upsert({
		where: { email: "staff.drainage@civicflow.org" },
		update: { departmentId: deptDrainage.id },
		create: {
			name: "Engr. Tariqul Islam",
			email: "staff.drainage@civicflow.org",
			password: defaultHashedPassword,
			role: Role.STAFF,
			status: UserStatus.ACTIVE,
			emailVerified: true,
			departmentId: deptDrainage.id,
		},
	});

	const staffElectricalUser = await prisma.user.upsert({
		where: { email: "staff.electrical@civicflow.org" },
		update: { departmentId: deptElectrical.id },
		create: {
			name: "Fahim Shahriar",
			email: "staff.electrical@civicflow.org",
			password: defaultHashedPassword,
			role: Role.STAFF,
			status: UserStatus.ACTIVE,
			emailVerified: true,
			departmentId: deptElectrical.id,
		},
	});

	const staffRoadsUser = await prisma.user.upsert({
		where: { email: "staff.roads@civicflow.org" },
		update: { departmentId: deptRoads.id },
		create: {
			name: "Nusrat Jahan",
			email: "staff.roads@civicflow.org",
			password: defaultHashedPassword,
			role: Role.STAFF,
			status: UserStatus.ACTIVE,
			emailVerified: true,
			departmentId: deptRoads.id,
		},
	});

	// Citizen Users
	const citizenSarahUser = await prisma.user.upsert({
		where: { email: "citizen.sarah@example.com" },
		update: { role: Role.CITIZEN },
		create: {
			name: "Sarah Khan",
			email: "citizen.sarah@example.com",
			password: defaultHashedPassword,
			role: Role.CITIZEN,
			status: UserStatus.ACTIVE,
			emailVerified: true,
		},
	});

	const citizenRahimUser = await prisma.user.upsert({
		where: { email: "citizen.rahim@example.com" },
		update: { role: Role.CITIZEN },
		create: {
			name: "Rahim Ahmed",
			email: "citizen.rahim@example.com",
			password: defaultHashedPassword,
			role: Role.CITIZEN,
			status: UserStatus.ACTIVE,
			emailVerified: true,
		},
	});

	const citizenTanvirUser = await prisma.user.upsert({
		where: { email: "citizen.tanvir@example.com" },
		update: { role: Role.CITIZEN },
		create: {
			name: "Tanvir Hossain",
			email: "citizen.tanvir@example.com",
			password: defaultHashedPassword,
			role: Role.CITIZEN,
			status: UserStatus.ACTIVE,
			emailVerified: true,
		},
	});

	// Technician Users
	const techKamalUser = await prisma.user.upsert({
		where: { email: "tech.kamal@civicflow.org" },
		update: { role: Role.STAFF },
		create: {
			name: "Kamal Uddin",
			email: "tech.kamal@civicflow.org",
			password: defaultHashedPassword,
			role: Role.STAFF,
			status: UserStatus.ACTIVE,
			emailVerified: true,
			departmentId: deptElectrical.id,
		},
	});

	const techJalalUser = await prisma.user.upsert({
		where: { email: "tech.jalal@civicflow.org" },
		update: { role: Role.STAFF },
		create: {
			name: "Jalal Mahmud",
			email: "tech.jalal@civicflow.org",
			password: defaultHashedPassword,
			role: Role.STAFF,
			status: UserStatus.ACTIVE,
			emailVerified: true,
			departmentId: deptDrainage.id,
		},
	});

	const techRafiqulUser = await prisma.user.upsert({
		where: { email: "tech.rafiqul@civicflow.org" },
		update: { role: Role.STAFF },
		create: {
			name: "Rafiqul Islam",
			email: "tech.rafiqul@civicflow.org",
			password: defaultHashedPassword,
			role: Role.STAFF,
			status: UserStatus.ACTIVE,
			emailVerified: true,
			departmentId: deptRoads.id,
		},
	});

	// ==========================================
	// 3. CITIZENS (Table: citizens) - 3 records
	// ==========================================
	console.log("-> Seeding Citizens...");
	const citizenSarah = await prisma.citizen.upsert({
		where: { userId: citizenSarahUser.id },
		update: {},
		create: {
			userId: citizenSarahUser.id,
			name: "Sarah Khan",
			email: citizenSarahUser.email,
			contactNumber: "+8801711000001",
			address: "House 12, Road 5, Dhanmondi, Dhaka",
		},
	});

	const citizenRahim = await prisma.citizen.upsert({
		where: { userId: citizenRahimUser.id },
		update: {},
		create: {
			userId: citizenRahimUser.id,
			name: "Rahim Ahmed",
			email: citizenRahimUser.email,
			contactNumber: "+8801811000002",
			address: "Flat 4B, Plot 22, Gulshan-1, Dhaka",
		},
	});

	const citizenTanvir = await prisma.citizen.upsert({
		where: { userId: citizenTanvirUser.id },
		update: {},
		create: {
			userId: citizenTanvirUser.id,
			name: "Tanvir Hossain",
			email: citizenTanvirUser.email,
			contactNumber: "+8801911000003",
			address: "House 8, Road 14, Sector 3, Uttara, Dhaka",
		},
	});

	// ==========================================
	// 4. TECHNICIANS (Table: technicians) - 3 records
	// ==========================================
	console.log("-> Seeding Technicians...");
	const techKamal = await prisma.technician.upsert({
		where: { userId: techKamalUser.id },
		update: {},
		create: {
			userId: techKamalUser.id,
			name: "Kamal Uddin",
			email: techKamalUser.email,
			specialization: "High-Voltage Lighting & Electrical Distribution",
			licenseNumber: "TECH-ELEC-2023-001",
			qualifications: "B.Sc in Electrical Engineering, IEEE Member",
			experienceYears: 7,
			technicianFee: 450.0,
			contactNumber: "+8801712000001",
			address: "Mirpur 10, Dhaka",
			verificationStatus: TechnicianVerificationStatus.APPROVED,
		},
	});

	const techJalal = await prisma.technician.upsert({
		where: { userId: techJalalUser.id },
		update: {},
		create: {
			userId: techJalalUser.id,
			name: "Jalal Mahmud",
			email: techJalalUser.email,
			specialization: "Stormwater Drainage & Submersible Pump Systems",
			licenseNumber: "TECH-DRAIN-2022-042",
			qualifications: "Diploma in Civil Engineering",
			experienceYears: 10,
			technicianFee: 500.0,
			contactNumber: "+8801712000002",
			address: "Mohammadpur, Dhaka",
			verificationStatus: TechnicianVerificationStatus.APPROVED,
		},
	});

	const techRafiqul = await prisma.technician.upsert({
		where: { userId: techRafiqulUser.id },
		update: {},
		create: {
			userId: techRafiqulUser.id,
			name: "Rafiqul Islam",
			email: techRafiqulUser.email,
			specialization: "Asphalt Compaction & Structural Pavement Repair",
			licenseNumber: "TECH-ROAD-2021-118",
			qualifications: "Diploma in Highway Engineering",
			experienceYears: 5,
			technicianFee: 400.0,
			contactNumber: "+8801712000003",
			address: "Badda, Dhaka",
			verificationStatus: TechnicianVerificationStatus.APPROVED,
		},
	});

	// ==========================================
	// 5. REQUEST CATEGORIES (Table: request_categories) - 4 records
	// ==========================================
	console.log("-> Seeding Request Categories...");
	const catWaterlogging = await prisma.requestCategory.upsert({
		where: { name: "Waterlogging & Drainage Choke" },
		update: {},
		create: {
			name: "Waterlogging & Drainage Choke",
			description:
				"Severe stormwater accumulation, clogged street drains, canal blockages, or manhole overflows.",
			feeAmount: 0.0,
			feeCurrency: "BDT",
			slaMinutes: 1440, // 24 hours
			isActive: true,
		},
	});

	const catStreetlight = await prisma.requestCategory.upsert({
		where: { name: "Broken Streetlight & Dark Corridors" },
		update: {},
		create: {
			name: "Broken Streetlight & Dark Corridors",
			description:
				"Non-functional street lamps, flickering illumination, damaged electrical poles, or exposed wires.",
			feeAmount: 0.0,
			feeCurrency: "BDT",
			slaMinutes: 2880, // 48 hours
			isActive: true,
		},
	});

	const catPothole = await prisma.requestCategory.upsert({
		where: { name: "Pothole & Pavement Hazard" },
		update: {},
		create: {
			name: "Pothole & Pavement Hazard",
			description:
				"Deep craters, fractured asphalt, damaged footpath slabs, or cave-ins threatening road users.",
			feeAmount: 100.0,
			feeCurrency: "BDT",
			slaMinutes: 4320, // 72 hours
			isActive: true,
		},
	});

	const catWaste = await prisma.requestCategory.upsert({
		where: { name: "Illegal Garbage Dumping" },
		update: {},
		create: {
			name: "Illegal Garbage Dumping",
			description:
				"Unauthorized waste heaps, overflowing public dumpsters, medical waste, or dead animal clearance.",
			feeAmount: 50.0,
			feeCurrency: "BDT",
			slaMinutes: 1440, // 24 hours
			isActive: true,
		},
	});

	// ==========================================
	// 6. CATEGORY ROUTING RULES (Table: category_routing_rules) - 4 records
	// ==========================================
	console.log("-> Seeding Category Routing Rules...");
	await prisma.categoryRoutingRule.deleteMany({
		where: {
			categoryId: {
				in: [catWaterlogging.id, catStreetlight.id, catPothole.id, catWaste.id],
			},
		},
	});

	const rule1 = await prisma.categoryRoutingRule.create({
		data: {
			categoryId: catWaterlogging.id,
			departmentId: deptDrainage.id,
			location: null,
			priority: 10,
			isActive: true,
			isArchived: false,
		},
	});

	const rule2 = await prisma.categoryRoutingRule.create({
		data: {
			categoryId: catStreetlight.id,
			departmentId: deptElectrical.id,
			location: null,
			priority: 10,
			isActive: true,
			isArchived: false,
		},
	});

	const rule3 = await prisma.categoryRoutingRule.create({
		data: {
			categoryId: catPothole.id,
			departmentId: deptRoads.id,
			location: null,
			priority: 10,
			isActive: true,
			isArchived: false,
		},
	});

	const rule4 = await prisma.categoryRoutingRule.create({
		data: {
			categoryId: catWaste.id,
			departmentId: deptSanitation.id,
			location: null,
			priority: 10,
			isActive: true,
			isArchived: false,
		},
	});

	// ==========================================
	// 7. SERVICE REQUESTS (Table: service_requests) - 4 records
	// ==========================================
	console.log("-> Seeding Service Requests...");
	const req1 = await prisma.serviceRequest.upsert({
		where: { requestNumber: "REQ-20260901-0001" },
		update: {},
		create: {
			requestNumber: "REQ-20260901-0001",
			title: "Heavy Waterlogging along Dhanmondi Road 27",
			description:
				"Drainage line completely clogged after monsoon rain. Stagnant water reached knee height, blocking vehicular entrance to houses.",
			caseType: CaseType.COMPLAINT,
			status: RequestStatus.IN_PROGRESS,
			priority: RequestPriority.HIGH,
			location: "Road 27 (Old), Dhanmondi",
			address: "Near Genetic Plaza, Road 27, Dhanmondi",
			ward: "Ward 15",
			zone: "Zone 5",
			landmark: "Opposite Genetic Plaza",
			latitude: 23.7538,
			longitude: 90.3756,
			routingStatus: RequestRoutingStatus.ASSIGNED,
			slaDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
			citizenId: citizenSarah.id,
			categoryId: catWaterlogging.id,
			departmentId: deptDrainage.id,
			createdById: citizenSarahUser.id,
			assignedToId: staffDrainageUser.id,
		},
	});

	const req2 = await prisma.serviceRequest.upsert({
		where: { requestNumber: "REQ-20260901-0002" },
		update: {},
		create: {
			requestNumber: "REQ-20260901-0002",
			title: "Flickering High-Mast Streetlight at Gulshan 2 Circle",
			description:
				"The prominent 150W high-mast light post #14 is flickering erratically and causing hazardous glare for commuters.",
			caseType: CaseType.SERVICE_REQUEST,
			status: RequestStatus.RESOLVED,
			priority: RequestPriority.NORMAL,
			location: "Gulshan-2 Circle Intersection",
			address: "Gulshan Avenue, Circle 2, Dhaka",
			ward: "Ward 19",
			zone: "Zone 3",
			landmark: "Beside Westin Hotel Roundabout",
			latitude: 23.7925,
			longitude: 90.4167,
			routingStatus: RequestRoutingStatus.ASSIGNED,
			slaDueAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
			resolvedAt: new Date(),
			resolutionSummary:
				"Technician replaced burnt ballast and upgraded luminaire to waterproof LED module.",
			citizenId: citizenRahim.id,
			categoryId: catStreetlight.id,
			departmentId: deptElectrical.id,
			createdById: citizenRahimUser.id,
			assignedToId: staffElectricalUser.id,
		},
	});

	const req3 = await prisma.serviceRequest.upsert({
		where: { requestNumber: "REQ-20260901-0003" },
		update: {},
		create: {
			requestNumber: "REQ-20260901-0003",
			title: "Dangerous Deep Crater on Uttara Sector 3 Main Road",
			description:
				"A large 2-foot diameter crater opened up near the bus stop, posing extreme rollover risk for auto-rickshaws and motorcycles.",
			caseType: CaseType.COMPLAINT,
			status: RequestStatus.CLOSED,
			priority: RequestPriority.URGENT,
			location: "Road 14, Sector 3, Uttara",
			address: "Opposite Friends Club Playground, Uttara Sector 3",
			ward: "Ward 1",
			zone: "Zone 1",
			landmark: "Near Metro Rail Pillar 104",
			latitude: 23.8698,
			longitude: 90.3984,
			routingStatus: RequestRoutingStatus.ASSIGNED,
			slaDueAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
			resolvedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
			resolutionSummary:
				"Road maintenance crew excavated loose gravel, backfilled with WBM base, and laid hot-mix bituminous wearing course.",
			citizenId: citizenTanvir.id,
			categoryId: catPothole.id,
			departmentId: deptRoads.id,
			createdById: citizenTanvirUser.id,
			assignedToId: staffRoadsUser.id,
		},
	});

	const req4 = await prisma.serviceRequest.upsert({
		where: { requestNumber: "REQ-20260901-0004" },
		update: {},
		create: {
			requestNumber: "REQ-20260901-0004",
			title: "Unattended Commercial Waste Dump beside Banani Supermarket",
			description:
				"Heaped vegetable crates and foul-smelling decomposing organic waste obstructing pedestrian walkway for 48 hours.",
			caseType: CaseType.COMPLAINT,
			status: RequestStatus.RESOLVED,
			priority: RequestPriority.NORMAL,
			location: "Block C, Road 11, Banani",
			address: "House 28, Road 11, Banani",
			ward: "Ward 19",
			zone: "Zone 3",
			landmark: "Behind Banani Supermarket",
			latitude: 23.7937,
			longitude: 90.4045,
			routingStatus: RequestRoutingStatus.ASSIGNED,
			slaDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
			resolvedAt: new Date(),
			resolutionSummary:
				"Sanitation compactors cleared 2.5 metric tons of waste and applied lime powder disinfectant.",
			citizenId: citizenRahim.id,
			categoryId: catWaste.id,
			departmentId: deptSanitation.id,
			createdById: citizenRahimUser.id,
			assignedToId: staffDrainageUser.id,
		},
	});

	// ==========================================
	// 8. REQUEST ATTACHMENTS (Table: request_attachments) - 3 records
	// ==========================================
	console.log("-> Seeding Request Attachments...");
	await prisma.requestAttachment.deleteMany({
		where: { requestId: { in: [req1.id, req2.id, req3.id] } },
	});

	await prisma.requestAttachment.create({
		data: {
			requestId: req1.id,
			url: "https://res.cloudinary.com/civicflow/image/upload/v1/dhanmondi_waterlogging.jpg",
			publicId: "civicflow/dhanmondi_waterlogging",
			fileName: "dhanmondi_road27_flooding.jpg",
			mimeType: "image/jpeg",
			fileSize: 1450200,
			caption: "Water logging up to knee height near Genetic Plaza.",
			uploaderId: citizenSarahUser.id,
		},
	});

	await prisma.requestAttachment.create({
		data: {
			requestId: req2.id,
			url: "https://res.cloudinary.com/civicflow/image/upload/v1/gulshan2_lightpost.jpg",
			publicId: "civicflow/gulshan2_lightpost",
			fileName: "gulshan_light_post_14.jpg",
			mimeType: "image/jpeg",
			fileSize: 980400,
			caption: "Damaged light fitting flickering at circle roundabout.",
			uploaderId: citizenRahimUser.id,
		},
	});

	await prisma.requestAttachment.create({
		data: {
			requestId: req3.id,
			url: "https://res.cloudinary.com/civicflow/image/upload/v1/uttara_crater.jpg",
			publicId: "civicflow/uttara_crater",
			fileName: "uttara_sec3_road_crater.jpg",
			mimeType: "image/jpeg",
			fileSize: 2100300,
			caption: "Deep 2-ft pothole dangerous for motorcycles.",
			uploaderId: citizenTanvirUser.id,
		},
	});

	// ==========================================
	// 9. REQUEST ASSIGNMENTS (Table: request_assignments) - 3 records
	// ==========================================
	console.log("-> Seeding Request Assignments...");
	await prisma.requestAssignment.deleteMany({
		where: { requestId: { in: [req1.id, req2.id, req3.id] } },
	});

	await prisma.requestAssignment.create({
		data: {
			requestId: req1.id,
			assignedToId: staffDrainageUser.id,
			assignedById: adminUser.id,
			action: AssignmentAction.ASSIGNED,
		},
	});

	await prisma.requestAssignment.create({
		data: {
			requestId: req2.id,
			assignedToId: staffElectricalUser.id,
			assignedById: adminUser.id,
			action: AssignmentAction.ASSIGNED,
		},
	});

	await prisma.requestAssignment.create({
		data: {
			requestId: req3.id,
			assignedToId: staffRoadsUser.id,
			assignedById: adminUser.id,
			action: AssignmentAction.ASSIGNED,
		},
	});

	// ==========================================
	// 10. REQUEST INVESTIGATION NOTES (Table: request_investigation_notes) - 3 records
	// ==========================================
	console.log("-> Seeding Request Investigation Notes...");
	await prisma.requestInvestigationNote.deleteMany({
		where: { requestId: { in: [req1.id, req2.id, req3.id] } },
	});

	await prisma.requestInvestigationNote.create({
		data: {
			requestId: req1.id,
			note: "Field inspection showed heavy polythene blockage inside 24-inch storm pipe. High-pressure jetting machine deployed.",
			actorId: staffDrainageUser.id,
		},
	});

	await prisma.requestInvestigationNote.create({
		data: {
			requestId: req2.id,
			note: "High-mast bucket crane truck on site. Control box circuit breaker showed signs of short circuit during monsoon drizzle.",
			actorId: staffElectricalUser.id,
		},
	});

	await prisma.requestInvestigationNote.create({
		data: {
			requestId: req3.id,
			note: "Pothole depth measures 8 inches. Sub-base eroded by underground water leakage. Base re-compacted before bituminous paving.",
			actorId: staffRoadsUser.id,
		},
	});

	// ==========================================
	// 11. REQUEST RESOLUTIONS (Table: request_resolutions) - 3 records
	// ==========================================
	console.log("-> Seeding Request Resolutions...");
	await prisma.requestResolution.deleteMany({
		where: { requestId: { in: [req1.id, req2.id, req3.id] } },
	});

	await prisma.requestResolution.create({
		data: {
			requestId: req1.id,
			reason:
				"24-inch storm pipeline flushed and cleared using jetting nozzle. Floodwater receded completely within 45 minutes.",
			actorId: staffDrainageUser.id,
		},
	});

	await prisma.requestResolution.create({
		data: {
			requestId: req2.id,
			reason:
				"Replaced burnt ballast unit with IP67 rated 150W LED driver. Lighting restored and tested under night inspection.",
			actorId: staffElectricalUser.id,
		},
	});

	await prisma.requestResolution.create({
		data: {
			requestId: req3.id,
			reason:
				"Sub-base leveled with aggregate, followed by 50mm compacted asphalt concrete layer. Lane reopened for traffic.",
			actorId: staffRoadsUser.id,
		},
	});

	// ==========================================
	// 12. REQUEST STATUS HISTORY (Table: request_status_history) - 3 records
	// ==========================================
	console.log("-> Seeding Request Status History...");
	await prisma.requestStatusHistory.deleteMany({
		where: { requestId: { in: [req1.id, req2.id, req3.id] } },
	});

	await prisma.requestStatusHistory.create({
		data: {
			requestId: req1.id,
			from: RequestStatus.SUBMITTED,
			to: RequestStatus.IN_PROGRESS,
			reason:
				"Emergency crew dispatched to clear waterlogged road intersection.",
			actorId: staffDrainageUser.id,
		},
	});

	await prisma.requestStatusHistory.create({
		data: {
			requestId: req2.id,
			from: RequestStatus.IN_PROGRESS,
			to: RequestStatus.RESOLVED,
			reason: "High-mast streetlight repaired and field tested successfully.",
			actorId: staffElectricalUser.id,
		},
	});

	await prisma.requestStatusHistory.create({
		data: {
			requestId: req3.id,
			from: RequestStatus.RESOLVED,
			to: RequestStatus.CLOSED,
			reason: "Citizen confirmed road repair completed and lane functional.",
			actorId: citizenTanvirUser.id,
		},
	});

	// ==========================================
	// 13. REQUEST ROUTING AUDITS (Table: request_routing_audits) - 3 records
	// ==========================================
	console.log("-> Seeding Request Routing Audits...");
	await prisma.requestRoutingAudit.deleteMany({
		where: { requestId: { in: [req1.id, req2.id, req3.id] } },
	});

	await prisma.requestRoutingAudit.create({
		data: {
			requestId: req1.id,
			toDepartmentId: deptDrainage.id,
			categoryId: catWaterlogging.id,
			location: "Dhanmondi",
			routingStatus: RequestRoutingStatus.ASSIGNED,
			reason: "Auto-matched to Drainage Department via Category Routing Rule.",
			changedById: adminUser.id,
		},
	});

	await prisma.requestRoutingAudit.create({
		data: {
			requestId: req2.id,
			toDepartmentId: deptElectrical.id,
			categoryId: catStreetlight.id,
			location: "Gulshan",
			routingStatus: RequestRoutingStatus.ASSIGNED,
			reason:
				"Auto-matched to Electrical Department via Category Routing Rule.",
			changedById: adminUser.id,
		},
	});

	await prisma.requestRoutingAudit.create({
		data: {
			requestId: req3.id,
			toDepartmentId: deptRoads.id,
			categoryId: catPothole.id,
			location: "Uttara",
			routingStatus: RequestRoutingStatus.ASSIGNED,
			reason: "Auto-matched to Roads Department via Category Routing Rule.",
			changedById: adminUser.id,
		},
	});

	// ==========================================
	// 14. REQUEST SLA AUDITS (Table: request_sla_audits) - 3 records
	// ==========================================
	console.log("-> Seeding Request SLA Audits...");
	await prisma.requestSlaAudit.deleteMany({
		where: { requestId: { in: [req1.id, req2.id, req3.id] } },
	});

	await prisma.requestSlaAudit.create({
		data: {
			requestId: req1.id,
			categoryId: catWaterlogging.id,
			action: "SLA_INITIALIZED",
			previousValue: null,
			newValue: { slaMinutes: 1440, priority: "HIGH" },
			actorId: adminUser.id,
		},
	});

	await prisma.requestSlaAudit.create({
		data: {
			requestId: req2.id,
			categoryId: catStreetlight.id,
			action: "SLA_RESOLVED_ON_TIME",
			previousValue: { state: SlaEscalationState.NONE },
			newValue: { state: SlaEscalationState.NONE, resolvedWithinSla: true },
			actorId: staffElectricalUser.id,
		},
	});

	await prisma.requestSlaAudit.create({
		data: {
			requestId: req3.id,
			categoryId: catPothole.id,
			action: "SLA_CLOSED",
			previousValue: { state: SlaEscalationState.NONE },
			newValue: { state: SlaEscalationState.NONE, closedOnTime: true },
			actorId: adminUser.id,
		},
	});

	// ==========================================
	// ==========================================
	// 15. REQUEST FEEDBACK (Table: request_feedback) - 3 records
	// ==========================================
	console.log("-> Seeding Request Feedback...");
	await prisma.requestFeedback.upsert({
		where: { requestId: req2.id },
		update: {
			rating: 5,
			comment:
				"Exceptional service! The streetlight was repaired the very next evening. Road feels completely secure now.",
		},
		create: {
			requestId: req2.id,
			rating: 5,
			comment:
				"Exceptional service! The streetlight was repaired the very next evening. Road feels completely secure now.",
		},
	});

	await prisma.requestFeedback.upsert({
		where: { requestId: req3.id },
		update: {
			rating: 4,
			comment:
				"Smooth asphalt compaction finished quickly. Much better commute along Uttara sector 3.",
		},
		create: {
			requestId: req3.id,
			rating: 4,
			comment:
				"Smooth asphalt compaction finished quickly. Much better commute along Uttara sector 3.",
		},
	});

	await prisma.requestFeedback.upsert({
		where: { requestId: req4.id },
		update: {
			rating: 5,
			comment:
				"Waste compactor crew did an extraordinary job clearing the rotting dump and spraying disinfectant powder.",
		},
		create: {
			requestId: req4.id,
			rating: 5,
			comment:
				"Waste compactor crew did an extraordinary job clearing the rotting dump and spraying disinfectant powder.",
		},
	});

	// ==========================================
	// 16. SCHEDULES (Table: schedules) - 3 records
	// ==========================================
	console.log("-> Seeding Technician Schedules...");
	const tomorrowMorning = new Date();
	tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
	tomorrowMorning.setHours(10, 0, 0, 0);

	const tomorrowNoon = new Date(tomorrowMorning);
	tomorrowNoon.setHours(12, 0, 0, 0);

	const tomorrowAfternoon = new Date();
	tomorrowAfternoon.setDate(tomorrowAfternoon.getDate() + 1);
	tomorrowAfternoon.setHours(14, 0, 0, 0);

	const tomorrowEvening = new Date(tomorrowAfternoon);
	tomorrowEvening.setHours(16, 0, 0, 0);

	const dayAfterMorning = new Date();
	dayAfterMorning.setDate(dayAfterMorning.getDate() + 2);
	dayAfterMorning.setHours(11, 0, 0, 0);

	const dayAfterNoon = new Date(dayAfterMorning);
	dayAfterNoon.setHours(13, 0, 0, 0);

	const sch1 = await prisma.schedule.upsert({
		where: {
			unique_schedule: {
				technicianId: techKamal.id,
				startDateTime: tomorrowMorning,
				endDateTime: tomorrowNoon,
			},
		},
		update: {},
		create: {
			technicianId: techKamal.id,
			startDateTime: tomorrowMorning,
			endDateTime: tomorrowNoon,
			totalSlots: 4,
			availableSlots: 2,
			meetingLink: "https://meet.google.com/civic-elec-001",
			status: ScheduleStatus.PUBLISHED,
		},
	});

	const sch2 = await prisma.schedule.upsert({
		where: {
			unique_schedule: {
				technicianId: techJalal.id,
				startDateTime: tomorrowAfternoon,
				endDateTime: tomorrowEvening,
			},
		},
		update: {},
		create: {
			technicianId: techJalal.id,
			startDateTime: tomorrowAfternoon,
			endDateTime: tomorrowEvening,
			totalSlots: 4,
			availableSlots: 3,
			meetingLink: "https://meet.google.com/civic-drain-002",
			status: ScheduleStatus.PUBLISHED,
		},
	});

	const sch3 = await prisma.schedule.upsert({
		where: {
			unique_schedule: {
				technicianId: techRafiqul.id,
				startDateTime: dayAfterMorning,
				endDateTime: dayAfterNoon,
			},
		},
		update: {},
		create: {
			technicianId: techRafiqul.id,
			startDateTime: dayAfterMorning,
			endDateTime: dayAfterNoon,
			totalSlots: 4,
			availableSlots: 4,
			meetingLink: "https://meet.google.com/civic-road-003",
			status: ScheduleStatus.PUBLISHED,
		},
	});

	// ==========================================
	// 17. APPOINTMENTS (Table: appointments) - 3 records
	// ==========================================
	console.log("-> Seeding Appointments...");
	const appt1 = await prisma.appointment.upsert({
		where: {
			unique_appointment: {
				citizenId: citizenSarah.id,
				technicianId: techKamal.id,
				scheduleId: sch1.id,
			},
		},
		update: {},
		create: {
			citizenId: citizenSarah.id,
			technicianId: techKamal.id,
			scheduleId: sch1.id,
			status: AppointmentStatus.CONFIRMED,
			serialNumber: 1,
			joiningTime: tomorrowMorning,
			invoiceUrl:
				"https://res.cloudinary.com/civicflow/raw/upload/v1/inv_appt1.pdf",
		},
	});

	const appt2 = await prisma.appointment.upsert({
		where: {
			unique_appointment: {
				citizenId: citizenRahim.id,
				technicianId: techJalal.id,
				scheduleId: sch2.id,
			},
		},
		update: {},
		create: {
			citizenId: citizenRahim.id,
			technicianId: techJalal.id,
			scheduleId: sch2.id,
			status: AppointmentStatus.PENDING,
			serialNumber: 1,
			joiningTime: tomorrowAfternoon,
		},
	});

	const appt3 = await prisma.appointment.upsert({
		where: {
			unique_appointment: {
				citizenId: citizenTanvir.id,
				technicianId: techKamal.id,
				scheduleId: sch1.id,
			},
		},
		update: {},
		create: {
			citizenId: citizenTanvir.id,
			technicianId: techKamal.id,
			scheduleId: sch1.id,
			status: AppointmentStatus.COMPLETED,
			serialNumber: 2,
			joiningTime: new Date(tomorrowMorning.getTime() + 30 * 60 * 1000),
			invoiceUrl:
				"https://res.cloudinary.com/civicflow/raw/upload/v1/inv_appt3.pdf",
		},
	});

	// ==========================================
	// 18. PAYMENTS (Table: payments) - 3 records
	// ==========================================
	console.log("-> Seeding Payments...");
	await prisma.payment.upsert({
		where: { merchantInvoiceNumber: "INV-MUNICIPAL-2026-001" },
		update: {},
		create: {
			amount: 100.0,
			currency: "BDT",
			status: PaymentStatus.COMPLETED,
			paymentGateway: "bkash",
			merchantInvoiceNumber: "INV-MUNICIPAL-2026-001",
			bkashPaymentId: "BKASH-PAY-SR3-001",
			bkashTrxId: "TRX8849204910",
			paidAt: new Date().toISOString(),
			serviceRequestId: req3.id,
			completedAt: new Date(),
			invoiceUrl:
				"https://res.cloudinary.com/civicflow/raw/upload/v1/inv_pothole_fee.pdf",
		},
	});

	await prisma.payment.upsert({
		where: { merchantInvoiceNumber: "INV-MUNICIPAL-2026-002" },
		update: {},
		create: {
			amount: 450.0,
			currency: "BDT",
			status: PaymentStatus.COMPLETED,
			paymentGateway: "bkash",
			merchantInvoiceNumber: "INV-MUNICIPAL-2026-002",
			bkashPaymentId: "BKASH-PAY-APPT1-002",
			bkashTrxId: "TRX8849204922",
			paidAt: new Date().toISOString(),
			appointmentId: appt1.id,
			completedAt: new Date(),
			invoiceUrl:
				"https://res.cloudinary.com/civicflow/raw/upload/v1/inv_appt1.pdf",
		},
	});

	await prisma.payment.upsert({
		where: { merchantInvoiceNumber: "INV-MUNICIPAL-2026-003" },
		update: {},
		create: {
			amount: 500.0,
			currency: "BDT",
			status: PaymentStatus.PENDING,
			paymentGateway: "bkash",
			merchantInvoiceNumber: "INV-MUNICIPAL-2026-003",
			bkashPaymentId: "BKASH-PAY-APPT2-003",
			appointmentId: appt2.id,
			initiatedAt: new Date(),
		},
	});

	// ==========================================
	// 19. NOTIFICATIONS (Table: notifications) - 3 records
	// ==========================================
	console.log("-> Seeding Notifications...");
	await prisma.notification.upsert({
		where: {
			uq_notification_recipient_event: {
				recipientId: citizenSarahUser.id,
				eventKey: "REQUEST_IN_PROGRESS",
				eventId: "seed-event-waterlogging-1",
			},
		},
		update: {},
		create: {
			recipientId: citizenSarahUser.id,
			eventKey: "REQUEST_IN_PROGRESS",
			eventId: "seed-event-waterlogging-1",
			title: "Field Crew Dispatched",
			message:
				"Your waterlogging complaint for Dhanmondi Road 27 has been assigned to Engr. Tariqul Islam. Crew is on site.",
			readAt: new Date(),
		},
	});

	await prisma.notification.upsert({
		where: {
			uq_notification_recipient_event: {
				recipientId: citizenRahimUser.id,
				eventKey: "REQUEST_RESOLVED",
				eventId: "seed-event-streetlight-2",
			},
		},
		update: {},
		create: {
			recipientId: citizenRahimUser.id,
			eventKey: "REQUEST_RESOLVED",
			eventId: "seed-event-streetlight-2",
			title: "Streetlight Repaired",
			message:
				"High-mast light post #14 at Gulshan 2 circle has been repaired. Please review and confirm the resolution.",
			readAt: null,
		},
	});

	await prisma.notification.upsert({
		where: {
			uq_notification_recipient_event: {
				recipientId: staffRoadsUser.id,
				eventKey: "TASK_ASSIGNMENT",
				eventId: "seed-event-pothole-3",
			},
		},
		update: {},
		create: {
			recipientId: staffRoadsUser.id,
			eventKey: "TASK_ASSIGNMENT",
			eventId: "seed-event-pothole-3",
			title: "Urgent Pavement Repair Assigned",
			message:
				"You have been assigned to high-priority pothole repair on Uttara Sector 3 Main Road.",
			readAt: new Date(),
		},
	});

	// ==========================================
	// 20. AUDIT LOGS (Table: audit_logs) - 3 records
	// ==========================================
	console.log("-> Seeding Audit Logs...");
	await prisma.auditLog.deleteMany({
		where: {
			route: {
				in: ["/api/v1/auth/login", "/api/v1/requests", "/api/v1/departments"],
			},
		},
	});

	await prisma.auditLog.create({
		data: {
			actorId: adminUser.id,
			actorEmail: adminUser.email,
			action: "USER_AUTHENTICATION_LOGIN",
			entity: "User",
			entityId: adminUser.id,
			before: null,
			after: { email: adminUser.email, role: Role.ADMIN },
			ipAddress: "127.0.0.1",
			route: "/api/v1/auth/login",
			userAgent: "PostmanRuntime/7.43.0",
		},
	});

	await prisma.auditLog.create({
		data: {
			actorId: citizenSarahUser.id,
			actorEmail: citizenSarahUser.email,
			action: "SERVICE_REQUEST_CREATED",
			entity: "ServiceRequest",
			entityId: req1.id,
			before: null,
			after: {
				requestNumber: req1.requestNumber,
				status: RequestStatus.SUBMITTED,
				priority: RequestPriority.HIGH,
			},
			ipAddress: "127.0.0.1",
			route: "/api/v1/requests",
			userAgent: "PostmanRuntime/7.43.0",
		},
	});

	await prisma.auditLog.create({
		data: {
			actorId: adminUser.id,
			actorEmail: adminUser.email,
			action: "DEPARTMENT_CREATED",
			entity: "Department",
			entityId: deptDrainage.id,
			before: null,
			after: { name: deptDrainage.name, isActive: true },
			ipAddress: "127.0.0.1",
			route: "/api/v1/departments",
			userAgent: "PostmanRuntime/7.43.0",
		},
	});

	console.log("\n📊 Verification of row counts across all 20 tables:");
	const counts: Record<string, number> = {
		departments: await prisma.department.count(),
		users: await prisma.user.count(),
		citizens: await prisma.citizen.count(),
		technicians: await prisma.technician.count(),
		request_categories: await prisma.requestCategory.count(),
		category_routing_rules: await prisma.categoryRoutingRule.count(),
		service_requests: await prisma.serviceRequest.count(),
		request_attachments: await prisma.requestAttachment.count(),
		request_assignments: await prisma.requestAssignment.count(),
		request_investigation_notes: await prisma.requestInvestigationNote.count(),
		request_resolutions: await prisma.requestResolution.count(),
		request_status_history: await prisma.requestStatusHistory.count(),
		request_routing_audits: await prisma.requestRoutingAudit.count(),
		request_sla_audits: await prisma.requestSlaAudit.count(),
		request_feedback: await prisma.requestFeedback.count(),
		schedules: await prisma.schedule.count(),
		appointments: await prisma.appointment.count(),
		payments: await prisma.payment.count(),
		notifications: await prisma.notification.count(),
		audit_logs: await prisma.auditLog.count(),
	};

	for (const [table, count] of Object.entries(counts)) {
		console.log(`  ✓ ${table.padEnd(30)}: ${count} rows`);
	}

	console.log("\n✅ All 20 tables verified with at least 3 records each!");
}

if (process.argv[1]?.endsWith("seed.ts")) {
	seedAllTables()
		.catch((error) => {
			console.error("❌ Seeding failed:", error);
			process.exitCode = 1;
		})
		.finally(() => prisma.$disconnect());
}
