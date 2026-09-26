# CivicFlow API — Municipal Service & Civic Complaint Management Engine

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express-v5.2-lightgrey.svg)](https://expressjs.com/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-v7.9-indigo.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-Upstash%20%2F%20Local-red.svg)](https://redis.io/)
[![Biome](https://img.shields.io/badge/Linter-Biome-yellow.svg)](https://biomejs.dev/)
[![License](https://img.shields.io/badge/license-Private-green.svg)]()

> **CivicFlow** is an enterprise-grade municipal complaint resolution and citizen service orchestration backend. It bridges urban citizens, specialized municipal field departments, and city administrative leadership through a deterministic workflow state machine, automated category and ward routing, strict Service Level Agreement (SLA) monitoring, real-time notifications, digital bKash fee checkout with PDF invoice generation, and comprehensive auditability.

---

## 📑 Table of Contents

1. [Project Overview](#-1-project-overview)
   - [Mission & Key Capabilities](#11-mission--key-capabilities)
   - [Core Architecture Highlights](#12-core-architecture-highlights)
2. [Technology Stack](#-2-technology-stack)
3. [Role-Based Access Control (RBAC)](#-3-role-based-access-control-rbac)
4. [Request Lifecycle & Finite State Machine (FSM)](#-4-request-lifecycle--finite-state-machine-fsm)
   - [FSM State Diagram](#41-fsm-state-diagram)
   - [Status Transition Rules](#42-status-transition-rules)
   - [SLA Tracking & Pause Protocol](#43-sla-tracking--pause-protocol)
5. [Database Schema & Data Models](#-5-database-schema--data-models)
   - [Entity Relationship Diagram](#51-entity-relationship-diagram)
   - [Model Breakdown](#52-model-breakdown)
   - [System Enumerations](#53-system-enumerations)
6. [API Endpoint Reference with Role Permissions](#-6-api-endpoint-reference-with-role-permissions)
   - [6.1 System Base & Health](#61-system-base--health)
   - [6.2 Authentication & Profile (`/api/v1/auth`)](#62-authentication--profile-apiv1auth)
   - [6.3 User Management (`/api/v1/user`)](#63-user-management-apiv1user)
   - [6.4 Departments & Routing Rules (`/api/v1/departments`)](#64-departments--routing-rules-apiv1departments)
   - [6.5 Service Requests & Operations (`/api/v1/requests`)](#65-service-requests--operations-apiv1requests)
   - [6.6 Staff Work Queues (`/api/v1/requests/queue/...`)](#66-staff-work-queues-apiv1requestsqueue)
   - [6.7 Evidence & Attachments (`/api/v1/requests/:requestId/attachments`)](#67-evidence--attachments-apiv1requestsrequestidattachments)
   - [6.8 Citizen Feedback & Ratings (`/api/v1/requests` & `/api/v1/request-feedback`)](#68-citizen-feedback--ratings-apiv1requests--apiv1request-feedback)
   - [6.9 Service Level Agreements (`/api/v1/sla`)](#69-service-level-agreements-apiv1sla)
   - [6.10 In-App Notifications (`/api/v1/notifications`)](#610-in-app-notifications-apiv1notifications)
   - [6.11 Payment Gateway & Invoicing (`/api/v1/request-payments` & `/api/v1/payment`)](#611-payment-gateway--invoicing-apiv1request-payments--apiv1payment)
   - [6.12 Audit Logging Trail (`/api/v1/audit-logs`)](#612-audit-logging-trail-apiv1audit-logs)
   - [6.13 Administrative & Transparency Dashboards (`/api/v1/dashboard`)](#613-administrative--transparency-dashboards-apiv1dashboard)
7. [Environment Variables Configuration](#-7-environment-variables-configuration)
8. [Local Development & Setup Guide](#-8-local-development--setup-guide)
   - [Prerequisites](#81-prerequisites)
   - [Step-by-Step Installation](#82-step-by-step-installation)
   - [Database Seeding](#83-database-seeding)
   - [Background SLA Processing](#84-background-sla-processing)
   - [Testing & Quality Assurance](#85-testing--quality-assurance)
9. [Deployment & Serverless Execution](#-9-deployment--serverless-execution)
10. [Error Handling & API Envelopes](#-10-error-handling--api-envelopes)

---

## 🏛️ 1. Project Overview

### 1.1 Mission & Key Capabilities

Urban civic governance frequently suffers from siloed complaints, lost paper trails, lack of response timelines, and zero visibility for citizens. **CivicFlow API** provides a backend platform designed to address these challenges:

- **Citizen Issue Intake**: Citizens log grievances (waste accumulation, broken streetlights, water-logging, road hazards) with geospatial coordinates, landmarks, address metadata, and multi-file photographic evidence.
- **Intelligent Dispatch Engine**: Priority-weighted category and ward/location routing rules automatically link incoming requests to the designated municipal department (e.g., Drainage & Sewerage, Electrical & Public Lighting, Waste Management).
- **Dual Queue Operations**: Department field staff access both high-level **Department Queues** and focused **Personal Queues** (`/queue/me`), enabling clear assignment and rapid mobilization.
- **Strict FSM Lifecycle**: Every request transitions through deterministic states (`SUBMITTED` ➔ `TRIAGED` ➔ `ASSIGNED` ➔ `IN_PROGRESS` ➔ `RESOLVED` ➔ `CLOSED`). Discretionary transitions record explicit reasoning, timestamps, and actor identifiers.
- **Service Level Agreements (SLA)**: Automatic deadline computation based on category thresholds (e.g., 24 hours for emergency hazards vs. 72 hours for general repairs), automatic SLA pausing during citizen inquiries (`ON_HOLD` / `AWAITING_CITIZEN`), automatic breach flag tagging, and scheduled escalation triggers.
- **Citizen Empowerment Loop**: Citizens verify work upon resolution (`/confirm`), or trigger a case reopening (`/reopen`) within an administratively configured duration (e.g., 7 days) if issues persist.
- **Financial Settlement (bKash & PDF Invoicing)**: Seamless tokenized bKash payment gateway integration for service charges or municipal permits, coupled with automatic PDF invoice synthesis (via PDFKit) delivered through Cloudinary.
- **Immutable Audit Logging**: Every administrative action, department assignment, state transition, and payment event writes an immutable audit record with actor metadata and before/after state diffs.

### 1.2 Core Architecture Highlights

```text
HTTP Request
     │
     ▼
[ Express 5 Router & Middlewares ]
  ├── CORS & Cookie Parser
  ├── Rate Limiting & Multer Memory Storage
  ├── validateRequest (Zod Schema Engine)
  └── checkAuth (JWT Bearer Token / HTTP-only Cookies + RBAC Role Guard)
     │
     ▼
[ Controller Layer (catchAsync) ] ────► Reads sanitized payload, user session
     │
     ▼
[ Service Layer (Domain Logic) ] ─────► Transactions, Business Rules, State Machine
  ├── Prisma Client (Pool Adapter) ───► PostgreSQL Database
  ├── Redis Client ───────────────────► Token Caches, OTP Storage (TTL)
  ├── Cloudinary SDK ─────────────────► Image & PDF Media Bucket
  ├── Nodemailer Transporter ─────────► EJS Responsive Email Delivery
  └── PDFKit Engine ──────────────────► Vectorized Receipts & Invoices
     │
     ▼
[ sendResponse Envelope ] ────────────► Standardized JSON Response to Client
```

---

## 💻 2. Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Runtime** | [Node.js](https://nodejs.org/) v20+ | High-performance asynchronous JavaScript engine |
| **Language** | [TypeScript](https://www.typescriptlang.org/) v5.9 | Full strict mode, ESNext modules, zero runtime type errors |
| **Framework** | [Express](https://expressjs.com/) v5.2 | Scalable routing, native promise support in route handlers |
| **Database** | [PostgreSQL](https://www.postgresql.org/) v16+ | Relational persistence, connection pooling via `@prisma/adapter-pg` |
| **ORM** | [Prisma](https://www.prisma.io/) v7.9 | Split schema models (`prisma/schema/*.prisma`), type-safe client generation |
| **Caching / KV** | [Redis](https://redis.io/) (Upstash / Local) | Short-lived OTPs, registration states, rate-limiting store |
| **Validation** | [Zod](https://zod.dev/) v3/v4 | Strict runtime schema parsing for body, query params, and URL params |
| **Security & Auth** | JWT + bcryptjs + Google Auth | Bearer tokens, HTTP-only cookies, password hashing (10 salt rounds) |
| **Storage / Media** | [Cloudinary](https://cloudinary.com/) | Storage for evidence files, profile avatars, and PDF documents |
| **Mailing** | [Nodemailer](https://nodemailer.com/) + [EJS](https://ejs.co/) | Transactional HTML emails with responsive templating |
| **Payments** | [bKash Gateway](https://developer.bkash.com/) | Tokenized checkout, webhook reconciliation, transaction tracking |
| **Document Engine** | [PDFKit](https://pdfkit.org/) | Server-side vector PDF generation for official civic payment receipts |
| **Tooling & Linter**| [Biome](https://biomejs.dev/) | Sub-millisecond formatting and static analysis |
| **Testing** | Node Native Test Runner + TSX | Fast headless unit and integration test execution |

---

## 👥 3. Role-Based Access Control (RBAC)

The system enforces a strict 3-role security paradigm via [checkAuth.ts](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/src/app/middleware/checkAuth.ts):

| Role | Scope & Permissions | Permitted Actions |
| :--- | :--- | :--- |
| `CITIZEN` | **Citizen Consumer**<br>Bound to own profile & requests | - Register via OTP and authenticate via credentials or Google OAuth.<br>- Create civic service requests with geolocation and evidence attachments.<br>- Track status and inspect investigation notes on submitted requests.<br>- Confirm resolution (`RESOLVED` ➔ `CLOSED`) or reopen requests (`RESOLVED` ➔ `REOPENED`).<br>- Submit star ratings (1–5) and qualitative feedback.<br>- Pay service fees via bKash and download generated PDF invoices. |
| `STAFF` | **Department Field / Desk Officer**<br>Bound to assigned Department | - Access assigned Department Queue and Personal Assigned Queue (`/queue/me`).<br>- Transition request statuses through the FSM (`TRIAGED`, `IN_PROGRESS`, `AWAITING_CITIZEN`, `ON_HOLD`, `RESOLVED`).<br>- Append official investigation field notes and upload technical evidence.<br>- Reassign requests within their designated department.<br>- Escalate overdue SLA requests to supervisors. |
| `ADMIN` | **System & Municipal Administrator**<br>Global platform scope | - Complete governance over all users: inspect, assign roles, block, soft-delete.<br>- Create, edit, and archive Municipal Departments.<br>- Configure Category Routing Rules with location weights and priorities.<br>- Set and adjust category SLA durations (in minutes) and trigger SLA batch processors.<br>- Access citywide audit trails, payment logs, and executive analytics dashboards. |

---

## 🔄 4. Request Lifecycle & Finite State Machine (FSM)

### 4.1 FSM State Diagram

```mermaid
stateDiagram-v2
    [*] --> SUBMITTED : Citizen submits request

    SUBMITTED --> TRIAGED : Staff / Admin triage
    SUBMITTED --> REJECTED : Invalid / Out of Scope (Terminal)

    TRIAGED --> ASSIGNED : Routed to Department / Staff
    TRIAGED --> ON_HOLD : Awaiting internal resources
    TRIAGED --> REJECTED : Rejected during triage

    ASSIGNED --> IN_PROGRESS : Crew dispatched / work initiated
    ASSIGNED --> ON_HOLD : Weather / Logistics pause

    IN_PROGRESS --> AWAITING_CITIZEN : Staff needs citizen info
    IN_PROGRESS --> ON_HOLD : Temporary obstruction
    IN_PROGRESS --> RESOLVED : Field work completed

    AWAITING_CITIZEN --> IN_PROGRESS : Citizen responds
    AWAITING_CITIZEN --> ON_HOLD : Citizen delayed

    ON_HOLD --> TRIAGED : Returned to desk
    ON_HOLD --> IN_PROGRESS : Obstruction cleared

    RESOLVED --> CLOSED : Citizen confirms work
    RESOLVED --> REOPENED : Citizen reopens (within 7 days)

    REOPENED --> IN_PROGRESS : Investigation resumed
    REOPENED --> ON_HOLD : Placed on hold

    CLOSED --> REOPENED : Reopened within allowed window
    CLOSED --> [*] : Lifecycle finished
    REJECTED --> [*] : Lifecycle finished
```

### 4.2 Status Transition Rules

The state machine is enforced by [serviceRequest.service.ts](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/src/app/module/serviceRequest/serviceRequest.service.ts):

| Current Status | Allowed Next Statuses | Authorized Actors | Notes & Preconditions |
| :--- | :--- | :--- | :--- |
| `SUBMITTED` | `TRIAGED`, `REJECTED` | `ADMIN`, `STAFF` | Automatic routing rule evaluates on intake. |
| `TRIAGED` | `ASSIGNED`, `REJECTED`, `ON_HOLD` | `ADMIN`, `STAFF` | Assigned to a specific staff member. |
| `ASSIGNED` | `IN_PROGRESS`, `ON_HOLD` | `ADMIN`, `STAFF` | Assigned staff initiates operational tasks. |
| `IN_PROGRESS` | `AWAITING_CITIZEN`, `RESOLVED`, `ON_HOLD` | `ADMIN`, `STAFF` | Moving to `RESOLVED` requires a formal resolution reason. |
| `AWAITING_CITIZEN`| `IN_PROGRESS`, `ON_HOLD` | `ADMIN`, `STAFF` | SLA timer automatically pauses during this state. |
| `ON_HOLD` | `TRIAGED`, `IN_PROGRESS` | `ADMIN`, `STAFF` | Pauses SLA elapsed time; recalculates `slaDueAt` upon resumption. |
| `RESOLVED` | `CLOSED` (via `/confirm`), `REOPENED` (via `/reopen`) | `CITIZEN` (owner), `ADMIN` | Citizens confirm closure or reopen within the policy window. |
| `CLOSED` | `REOPENED` (within reopening window) | `CITIZEN` (owner), `ADMIN` | Blocked if beyond `REQUEST_REOPEN_WINDOW_DAYS` (default: 7). |
| `REOPENED` | `IN_PROGRESS`, `ON_HOLD` | `ADMIN`, `STAFF` | Reopened request triggers notification to department head. |
| `REJECTED` | *(None - Terminal)* | — | Terminal state; reason logged in status history. |

### 4.3 SLA Tracking & Pause Protocol

1. **Target SLA Due Date**: Calculated upon request creation:
   $$\text{slaDueAt} = \text{createdAt} + (\text{Category.slaMinutes} \times 60 \times 1000)$$
2. **SLA Pausing**:
   When a request transitions to `ON_HOLD` or `AWAITING_CITIZEN`, `slaPausedAt` is recorded.
3. **SLA Resumption**:
   When returning to `IN_PROGRESS`, the system computes elapsed paused duration, increments `slaPausedDurationSeconds`, and extends `slaDueAt` by the exact elapsed pause time.
4. **Breach Determination**:
   $$\text{Current Time} > \text{slaDueAt} \implies \text{slaEscalationState} = \text{BREACHED}$$
5. **Scheduled Batch Job**:
   The standalone job (`npm run sla:process`) evaluates overdue active requests, writes to `RequestSlaAudit`, marks records as breached, and sends alert notifications to administrators.

---

## 🗄️ 5. Database Schema & Data Models

The database schema utilizes Prisma's multi-file schema convention under `prisma/schema/`.

### 5.1 Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o| Citizen : "has profile"
    User ||--o| Technician : "has profile"
    User }o--o| Department : "belongs to"
    User ||--o{ ServiceRequest : "creates (citizen)"
    User ||--o{ ServiceRequest : "assignedTo (staff)"
    User ||--o{ RequestAssignment : "assigns / assignedTo"
    User ||--o{ RequestStatusHistory : "transitions"
    User ||--o{ RequestInvestigationNote : "authors"
    User ||--o{ RequestResolution : "resolves"
    User ||--o{ Notification : "receives"
    User ||--o{ AuditLog : "triggers"

    Department ||--o{ ServiceRequest : "handles"
    Department ||--o{ CategoryRoutingRule : "linked rules"

    RequestCategory ||--o{ ServiceRequest : "classifies"
    RequestCategory ||--o{ CategoryRoutingRule : "routed by"

    ServiceRequest ||--o{ RequestAttachment : "contains evidence"
    ServiceRequest ||--o{ RequestAssignment : "assignment history"
    ServiceRequest ||--o{ RequestStatusHistory : "lifecycle transitions"
    ServiceRequest ||--o{ RequestInvestigationNote : "field notes"
    ServiceRequest ||--o{ RequestResolution : "resolution records"
    ServiceRequest ||--o| RequestFeedback : "citizen evaluation"
    ServiceRequest ||--o{ Payment : "service charges"
    ServiceRequest ||--o{ RequestRoutingAudit : "routing traces"
    ServiceRequest ||--o{ RequestSlaAudit : "SLA history"

    Citizen ||--o{ ServiceRequest : "owns"
    Citizen ||--o{ Appointment : "books"
    Technician ||--o{ Appointment : "attends"
    Technician ||--o{ Schedule : "manages"
    Appointment ||--o| Payment : "settles"
```

### 5.2 Model Breakdown

#### 1. Identity & Profiles
- **`User`** ([user.prisma](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/prisma/schema/user.prisma)): Central authentication entity. Contains `name`, `email` (unique), `password`, `role` (`CITIZEN`, `STAFF`, `ADMIN`), `status` (`ACTIVE`, `BLOCKED`, `DELETED`), `authProvider` (`CREDENTIAL`, `GOOGLE`), `departmentId`, and Cloudinary profile photo metadata.
- **`Citizen`** ([citizen.prisma](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/prisma/schema/citizen.prisma)): Profile extension for citizen consumers. Holds `contactNumber`, `address`, and request links.
- **`Technician`** ([technician.prisma](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/prisma/schema/technician.prisma)): Profile extension for specialized technicians. Contains `specialization`, `licenseNumber`, `experienceYears`, `technicianFee`, and verification credentials.

#### 2. Municipal Structure & Routing
- **`Department`** ([department.prisma](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/prisma/schema/department.prisma)): Operational city units (e.g., Water & Sewerage, Roads, Electrical). Tracks active and archived states.
- **`RequestCategory`** ([requestCategory.prisma](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/prisma/schema/requestCategory.prisma)): Service and complaint classifications. Defines `feeAmount`, `feeCurrency`, and default `slaMinutes` (default: 1440 mins / 24 hours).
- **`CategoryRoutingRule`** ([categoryRoutingRule.prisma](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/prisma/schema/categoryRoutingRule.prisma)): Directs incoming requests of a given category and optional location (Ward/Zone) to the target department with an execution `priority`.

#### 3. Service Requests & Workflow
- **`ServiceRequest`** ([serviceRequest.prisma](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/prisma/schema/serviceRequest.prisma)): The central operational record. Contains:
  - `requestNumber`: Unique human-readable code (e.g., `REQ-20260327-ABC1`).
  - `title`, `description`, `caseType` (`COMPLAINT`, `SERVICE_REQUEST`), `status`, `priority` (`LOW`, `NORMAL`, `HIGH`, `URGENT`).
  - Geospatial fields: `location`, `address`, `ward`, `zone`, `landmark`, `latitude`, `longitude`.
  - Routing state: `routingStatus` (`MANUAL_REVIEW`, `ASSIGNED`).
  - SLA fields: `slaDueAt`, `slaPausedAt`, `slaPausedDurationSeconds`, `slaBreachedAt`, `slaEscalationState` (`NONE`, `BREACHED`, `ACKNOWLEDGED`, `ESCALATED`), `slaLastEvaluatedAt`.
  - Resolution info: `resolutionSummary`, `resolvedAt`.
- **`RequestAssignment`** ([requestAssignment.prisma](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/prisma/schema/requestAssignment.prisma)): Tracks staff assignment operations (`ASSIGNED`, `REASSIGNED`) with previous and new assignee references.
- **`RequestStatusHistory`** ([requestStatusHistory.prisma](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/prisma/schema/requestStatusHistory.prisma)): Immutable record of every status transition (`from`, `to`, `reason`, actor, timestamp).
- **`RequestInvestigationNote`** ([requestInvestigationNote.prisma](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/prisma/schema/requestInvestigationNote.prisma)): Internal field notes and updates logged by staff during investigation.
- **`RequestResolution`** ([requestResolution.prisma](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/prisma/schema/requestResolution.prisma)): Detailed resolution report entered when moving a case to `RESOLVED`.
- **`RequestAttachment`** ([requestAttachment.prisma](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/prisma/schema/requestAttachment.prisma)): Photographic and document evidence uploaded by citizens or staff (Cloudinary URL, public ID, MIME type, file size).
- **`RequestFeedback`** ([requestFeedback.prisma](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/prisma/schema/requestFeedback.prisma)): Citizen quality score (1 to 5 stars) and review text submitted post-resolution.

#### 4. Payments, Notifications & Audits
- **`Payment`** ([payment.prisma](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/prisma/schema/payment.prisma)): Financial record for service requests or technician appointments. Manages bKash transaction IDs, status (`UNPAID`, `PENDING`, `COMPLETED`, `FAILED`, `CANCELLED`, `REFUNDED`), and generated PDF invoice Cloudinary URLs.
- **`Notification`** ([notification.prisma](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/prisma/schema/notification.prisma)): In-app notifications with idempotency keys (`uq_notification_recipient_event`), read status, and structured metadata.
- **`AuditLog`** ([auditLog.prisma](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/prisma/schema/auditLog.prisma)): Systemwide immutable event log recording actor details, action names, entity types/IDs, and JSON before/after snapshots.
- **`RequestRoutingAudit`** & **`RequestSlaAudit`**: Specialized audit models for municipal routing changes and SLA modifications.

### 5.3 System Enumerations

Defined centrally in [enums.prisma](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/prisma/schema/enums.prisma):

```prisma
enum Role { CITIZEN, STAFF, ADMIN }
enum UserStatus { ACTIVE, BLOCKED, DELETED }
enum AuthProvider { CREDENTIAL, GOOGLE }
enum PaymentStatus { UNPAID, PENDING, COMPLETED, FAILED, CANCELLED, REFUNDED }
enum CaseType { COMPLAINT, SERVICE_REQUEST }
enum RequestPriority { LOW, NORMAL, HIGH, URGENT }
enum RequestRoutingStatus { MANUAL_REVIEW, ASSIGNED }
enum AssignmentAction { ASSIGNED, REASSIGNED }
enum SlaEscalationState { NONE, BREACHED, ACKNOWLEDGED, ESCALATED }
enum RequestStatus {
  SUBMITTED
  TRIAGED
  ASSIGNED
  IN_PROGRESS
  AWAITING_CITIZEN
  RESOLVED
  CLOSED
  REJECTED
  ON_HOLD
  REOPENED
}
```

---

## 📡 6. API Endpoint Reference with Role Permissions

> **Base URL**: `http://localhost:5000` (Local) / `https://<deployment-host>.vercel.app` (Production)  
> All protected routes expect an `Authorization: Bearer <token>` header or authenticated HTTP-only session cookie.

---

### 6.1 System Base & Health

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Public | System status and welcome check. |

---

### 6.2 Authentication & Profile (`/api/v1/auth`)

Mounted via [auth.route.ts](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/src/app/module/auth/auth.route.ts):

| Method | Endpoint | Authorization | Body / Query | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Public | `{ name, email, password }` | Registers an unverified user and sends a 6-digit OTP to Redis & email. |
| `POST` | `/api/v1/auth/verify-email` | Public | `{ email, otp }` | Verifies OTP from Redis, activates user in DB, issues access & refresh tokens. |
| `POST` | `/api/v1/auth/login` | Public | `{ email, password }` | Validates credentials, issues JWT access token & sets refresh token cookie. |
| `GET` | `/api/v1/auth/me` | Authenticated | None | Retrieves profile, role, department, and citizen/technician details for active user. |
| `POST` | `/api/v1/auth/google` | Public | `{ idToken }` | Authenticates or registers users via Google OAuth 2.0 token. |
| `POST` | `/api/v1/auth/refresh-token` | Refresh Cookie | None | Verifies refresh cookie, rotates token pair, and returns new access token. |
| `POST` | `/api/v1/auth/forgot-password`| Public | `{ email }` | Generates a 6-digit password reset OTP stored in Redis and delivered via email. |
| `POST` | `/api/v1/auth/reset-password` | Public | `{ email, otp, newPassword }`| Validates OTP and updates the password with 10 bcrypt salt rounds. |

---

### 6.3 User Management (`/api/v1/user`)

Mounted via [user.route.ts](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/src/app/module/user/user.route.ts):

| Method | Endpoint | Authorization | Body / Query | Description |
| :--- | :--- | :--- | :--- | :--- |
| `PATCH`| `/api/v1/user/profile-image` | Authenticated | `multipart/form-data` (`profileImage` file) | Uploads profile picture to Cloudinary and replaces old assets. |
| `GET` | `/api/v1/user` | `ADMIN` | `?page&limit&searchTerm&role&status&departmentId` | Paginated listing of users with search and department filtering. |
| `GET` | `/api/v1/user/:userId` | Authenticated | `userId` (URL param) | Fetches user details (Citizens/Staff can only access permitted scopes). |
| `PATCH`| `/api/v1/user/:userId` | `ADMIN` | `{ name?, role?, status?, departmentId? }` | Updates user properties, assigns staff roles, or changes account status. |
| `DELETE`| `/api/v1/user/:userId` | `ADMIN` | `userId` (URL param) | Performs soft-deletion (`isDeleted: true`, `status: DELETED`). |

---

### 6.4 Departments & Routing Rules (`/api/v1/departments`)

Mounted via [department.route.ts](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/src/app/module/department/department.route.ts):

| Method | Endpoint | Authorization | Body / Query | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/departments` | `ADMIN` | `?includeArchived=boolean` | Lists all municipal departments and staff counts. |
| `POST` | `/api/v1/departments` | `ADMIN` | `{ name, description? }` | Creates a new municipal department. |
| `PATCH`| `/api/v1/departments/:departmentId/archive` | `ADMIN` | `departmentId` (URL param) | Archives a department, preventing new routing rule linkages. |
| `PATCH`| `/api/v1/departments/staff/:userId/department` | `ADMIN` | `{ departmentId: string \| null }` | Assigns or unassigns a staff member to a department. |
| `GET` | `/api/v1/departments/routing-rules` | `ADMIN` | `?includeArchived=boolean` | Lists all automated category and location dispatch routing rules. |
| `POST` | `/api/v1/departments/routing-rules` | `ADMIN` | `{ categoryId, departmentId, location?, priority? }` | Creates an automated routing rule with optional location constraints. |
| `PATCH`| `/api/v1/departments/routing-rules/:ruleId/archive` | `ADMIN` | `ruleId` (URL param) | Archives a routing rule. |

---

### 6.5 Service Requests & Operations (`/api/v1/requests`)

Mounted via [serviceRequest.route.ts](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/src/app/module/serviceRequest/serviceRequest.route.ts):

| Method | Endpoint | Authorization | Body / Query | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/requests` | `CITIZEN`, `STAFF`, `ADMIN` | JSON or `multipart/form-data` (`files` up to 5) | Submits a new service request. Automatically routes to department based on rules. |
| `GET` | `/api/v1/requests` | Authenticated | `?page&limit&status&priority&categoryId&departmentId&ward&zone&searchTerm&overdue&sortBy&sortOrder` | Paginated listing. Citizens see own cases, Staff see department cases, Admin sees all. |
| `GET` | `/api/v1/requests/:requestId` | Authenticated | `requestId` (URL param) | Fetches complete request details including history, notes, and attachments. |
| `PATCH`| `/api/v1/requests/:requestId` | Authenticated | `{ title?, description?, priority?, landmark?, ... }` | Updates non-terminal request details according to role permissions. |
| `POST` | `/api/v1/requests/:requestId/transition` | `ADMIN`, `STAFF` | `{ status, reason }` | Moves request through the FSM. Enforces transition chart and logs history. |
| `POST` | `/api/v1/requests/:requestId/notes` | `ADMIN`, `STAFF` | `{ note }` | Appends an internal investigation field note to the request. |
| `POST` | `/api/v1/requests/:requestId/resolve` | `ADMIN`, `STAFF` | `{ reason }` | Moves status to `RESOLVED` and writes formal resolution summary. |
| `POST` | `/api/v1/requests/:requestId/confirm` | `CITIZEN` (owner) | Empty body `{}` | Citizen confirms resolution; transitions request from `RESOLVED` to `CLOSED`. |
| `POST` | `/api/v1/requests/:requestId/reopen` | `CITIZEN` (owner) | `{ reason }` | Citizen reopens an unsatisfactory resolution within the allowed window. |
| `POST` | `/api/v1/requests/:requestId/route` | `ADMIN` | Empty body `{}` | Re-triggers the automated category/location routing engine manually. |
| `POST` | `/api/v1/requests/:requestId/assign` | `ADMIN`, `STAFF` | `{ assignedToId }` | Assigns an unassigned or triaged request to a specific department staff member. |
| `POST` | `/api/v1/requests/:requestId/reassign` | `ADMIN`, `STAFF` | `{ assignedToId }` | Reassigns an existing request to another staff member. |
| `DELETE`| `/api/v1/requests/:requestId` | Authenticated | `requestId` (URL param) | Soft-deletes a request (`isDeleted: true`). Governed by ownership rules. |

---

### 6.6 Staff Work Queues (`/api/v1/requests/queue/...`)

Mounted via [serviceRequest.route.ts](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/src/app/module/serviceRequest/serviceRequest.route.ts):

| Method | Endpoint | Authorization | Query Parameters | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/requests/queue/me` | `STAFF` | `?page&limit&status&priority&overdue&sortBy&sortOrder` | Returns active requests assigned directly to the authenticated staff member. |
| `GET` | `/api/v1/requests/queue/department` | `STAFF` | `?page&limit&status&priority&overdue&sortBy&sortOrder` | Returns all active requests routed to the staff member's department. |

---

### 6.7 Evidence & Attachments (`/api/v1/requests/:requestId/attachments`)

Mounted via [serviceRequest.route.ts](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/src/app/module/serviceRequest/serviceRequest.route.ts):

| Method | Endpoint | Authorization | Body / Query | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/requests/:requestId/attachments` | Authenticated | `multipart/form-data` (`file`, optional `caption`) | Uploads photographic or document evidence to Cloudinary and links to request. |
| `GET` | `/api/v1/requests/:requestId/attachments` | Authenticated | None | Retrieves all active evidence attachments for the request. |
| `GET` | `/api/v1/requests/:requestId/attachments/:attachmentId` | Authenticated | `attachmentId` | Retrieves single attachment metadata. |
| `DELETE`| `/api/v1/requests/:requestId/attachments/:attachmentId` | Authenticated | `attachmentId` | Soft-deletes attachment record (uploader, assigned staff, or admin). |

---

### 6.8 Citizen Feedback & Ratings (`/api/v1/requests` & `/api/v1/request-feedback`)

Mounted via [requestFeedback.route.ts](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/src/app/module/requestFeedback/requestFeedback.route.ts):

| Method | Endpoint | Authorization | Body / Query | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/requests/:requestId/feedback` | `CITIZEN` (owner) | `{ rating: 1-5, comment? }` | Submits star rating and review after resolution or closure. |
| `GET` | `/api/v1/requests/:requestId/feedback` | `CITIZEN` (owner), `ADMIN` | None | Retrieves feedback details for a specific request. |
| `GET` | `/api/v1/request-feedback/report` | `ADMIN` | `?rating&status&categoryId&departmentId&from&to&page&limit` | Aggregated citizen satisfaction reports and rating distributions. |

---

### 6.9 Service Level Agreements (`/api/v1/sla`)

Mounted via [sla.route.ts](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/src/app/module/sla/sla.route.ts):

| Method | Endpoint | Authorization | Body / Query | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/sla/overdue` | `ADMIN`, `STAFF` | `?departmentId&categoryId&page&limit` | Lists all active requests exceeding their calculated SLA due date. |
| `PATCH`| `/api/v1/sla/categories/:categoryId` | `ADMIN` | `{ slaMinutes: number }` | Updates default SLA target duration for a service category. |
| `POST` | `/api/v1/sla/requests/:requestId/escalate` | `ADMIN`, `STAFF` | None | Marks an overdue request as escalated and alerts supervisors. |
| `POST` | `/api/v1/sla/process` | `ADMIN` | `{ limit?: number }` | Triggers batch evaluation of active requests for SLA breaches. |

---

### 6.10 In-App Notifications (`/api/v1/notifications`)

Mounted via [notification.route.ts](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/src/app/module/notification/notification.route.ts):

| Method | Endpoint | Authorization | Body / Query | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/notifications` | Authenticated | `?page&limit` | Retrieves paginated in-app alerts for the current user. |
| `GET` | `/api/v1/notifications/unread-count` | Authenticated | None | Returns total unread notification badge count. |
| `PATCH`| `/api/v1/notifications/:notificationId/read` | Authenticated | `notificationId` | Marks an alert as read (`readAt: now()`). |

---

### 6.11 Payment Gateway & Invoicing (`/api/v1/request-payments` & `/api/v1/payment`)

Mounted via [requestPayment.route.ts](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/src/app/module/requestPayment/requestPayment.route.ts) and [payment.route.ts](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/src/app/module/payment/payment.route.ts):

| Method | Endpoint | Authorization | Body / Query | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/request-payments/requests/:requestId/initiate` | `CITIZEN` (owner) | None | Creates a bKash checkout session for fee-eligible service requests. |
| `GET` | `/api/v1/request-payments/:paymentId/status` | Authenticated | `paymentId` | Checks real-time payment status and verification data. |
| `GET/POST`| `/api/v1/request-payments/bkash/callback/:result` | Public Webhook | `?paymentID=...` | Reconciles bKash transaction callbacks (`success`, `cancel`, `failure`). |
| `GET` | `/api/v1/payment/my-payments` | `CITIZEN` | `?page&limit` | Lists personal payment transaction history. |
| `GET` | `/api/v1/payment/all-payments` | `ADMIN` | `?page&limit&status&from&to` | Citywide administrative payment audit ledger. |
| `GET` | `/api/v1/payment/:paymentId` | Authenticated | `paymentId` | Detailed metadata for a single payment. |
| `GET` | `/api/v1/payment/:paymentId/invoice` | Authenticated | `paymentId` | Generates a vector PDF invoice (PDFKit), stores in Cloudinary, and returns URL. |

---

### 6.12 Audit Logging Trail (`/api/v1/audit-logs`)

Mounted via [auditLog.route.ts](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/src/app/module/auditLog/auditLog.route.ts):

| Method | Endpoint | Authorization | Query Parameters | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/audit-logs` | `ADMIN` | `?page&limit&actorId&action&entity&entityId&from&to&sortOrder` | Search and filter immutable audit events across all system models and actions. |

---

### 6.13 Administrative & Transparency Dashboards (`/api/v1/dashboard`)

Mounted via [dashboard.route.ts](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/src/app/module/dashboard/dashboard.route.ts):

| Method | Endpoint | Authorization | Query Parameters | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/dashboard/admin` | `ADMIN` | `?departmentId&from&to` | Aggregated executive KPIs: SLA compliance rate, resolution times, workload breakdown. |
| `GET` | `/api/v1/dashboard/public/stats` | Public | None | Open statistics for municipal transparency (total requests, resolved count, active depts). |

---

## ⚙️ 7. Environment Variables Configuration

Create a `.env` file in the root directory based on [.env.example](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/.env.example):

```bash
cp .env.example .env
```

| Variable Name | Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | String | `development` | Runtime environment (`development`, `production`, `test`) |
| `PORT` | Number | `5000` | Port on which the Express server listens |
| `DATABASE_URL` | String | *Required* | PostgreSQL connection string (supports direct URI or pooled URI) |
| `JWT_ACCESS_SECRET` | String | *Required* | Cryptographic secret for signing access JWT tokens |
| `JWT_REFRESH_SECRET` | String | *Required* | Cryptographic secret for signing refresh JWT tokens |
| `JWT_ACCESS_EXPIRES_IN` | String | `1d` | Access token time-to-live |
| `JWT_REFRESH_EXPIRES_IN`| String | `7d` | Refresh token time-to-live |
| `BCRYPT_SALT_ROUNDS` | Number | `10` | Salt rounds for password hashing |
| `REQUEST_REOPEN_WINDOW_DAYS`| Number | `7` | Maximum days after resolution that a citizen may reopen a case |
| `FRONTEND_URL` | String | `http://localhost:3000` | Allowed CORS origin |
| `BACKEND_URL` | String | `http://localhost:5000` | Public backend address |
| `SUPER_ADMIN_NAME` | String | `Super Admin` | Full name of seeded Super Admin |
| `SUPER_ADMIN_EMAIL` | String | `superadmin@example.com` | Email of seeded Super Admin |
| `SUPER_ADMIN_PASSWORD` | String | `Password@123` | Password of seeded Super Admin |
| `REDIS_URL` | String | *Required* | Redis connection URL (e.g. `rediss://default:...@...upstash.io:6379`) |
| `SMTP_USER` | String | Optional | SMTP username for outbound notification emails |
| `SMTP_PASSWORD` | String | Optional | SMTP app password |
| `EMAIL_SENDER` | String | `CivicFlow <noreply@example.com>` | Outgoing `From` header |
| `GOOGLE_CLIENT_ID` | String | Optional | Google OAuth 2.0 Web Client ID for Google login |
| `CLOUDINARY_CLOUD_NAME` | String | *Required* | Cloudinary cloud account identifier |
| `CLOUDINARY_API_KEY` | String | *Required* | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | String | *Required* | Cloudinary API secret |
| `BKASH_BASE_URL` | String | Optional | Sandbox/Live bKash endpoint |
| `BKASH_APP_KEY` | String | Optional | bKash merchant app key |
| `BKASH_APP_SECRET` | String | Optional | bKash merchant secret |
| `BKASH_USERNAME` | String | Optional | bKash merchant username |
| `BKASH_PASSWORD` | String | Optional | bKash merchant password |

---

## 🚀 8. Local Development & Setup Guide

### 8.1 Prerequisites

Ensure you have the following installed:
- **Node.js**: `v20.x` or later
- **npm**: `v10.x` or later
- **PostgreSQL**: `v15` or later running locally or hosted on Supabase / Neon
- **Redis**: Running locally via Docker or a free cloud instance on Upstash

### 8.2 Step-by-Step Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd B7A6-CivicFlowAPI
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Open .env and populate DATABASE_URL, REDIS_URL, and Cloudinary credentials
   ```

4. **Run database migrations:**
   ```bash
   npm run prisma:migrate
   ```

5. **Generate the Prisma client:**
   ```bash
   npm run prisma:generate
   ```

6. **Start the local development server (with TSX hot reloading):**
   ```bash
   npm run dev
   ```
   The API will listen at `http://localhost:5000`.

### 8.3 Database Seeding

The repository features an idempotent seed script in [prisma/seed.ts](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/prisma/seed.ts) that populates at least 3 to 5 realistic records across every table (Departments, Categories, Users, Routing Rules, Requests, Attachments, Notes, Resolutions, Feedback, and Audit Logs):

```bash
npm run seed
```

**Default Administrative Credentials:**
- **Email**: `superadmin@example.com`
- **Password**: `Password@123`
- **Role**: `ADMIN`

### 8.4 Background SLA Processing

To process SLA breaches and evaluate all active requests against their calculated deadlines:

```bash
npm run sla:process
```

*(In a production environment, this script should be scheduled via a system cron job or serverless periodic trigger every 5 to 15 minutes).*

### 8.5 Testing & Quality Assurance

1. **Execute Test Suites:**
   ```bash
   npm test
   ```
   Runs native Node.js tests including:
   - State machine transition validations
   - SLA pause and resume calculations
   - Audit logging generation
   - In-app notification triggers
   - Vector PDF invoice compilation

2. **Check Code Formatting & Lints:**
   ```bash
   npm run lint:check
   npm run format:check
   ```

3. **Auto-Fix Formatting:**
   ```bash
   npm run format:fix
   npm run lint:fix
   ```

---

## ☁️ 9. Deployment & Serverless Execution

The codebase is configured for serverless deployment on **Vercel** via [vercel.json](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/vercel.json) and [api/index.ts](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/api/index.ts).

### Serverless Architecture Highlights:
- **Prisma Connection Pooling**: Uses `@prisma/adapter-pg` pool adapter with PostgreSQL connection reuse across warm invocations.
- **Cold-Start Resilience**: The `bootstrap()` routine ensures database connection and default Super Admin verification occur once per cold start. Redis connection failures are caught gracefully to prevent function crashes.
- **Vercel Build Command**: Automatically executes `prisma generate` via `npm run vercel-build`.

---

## 🛡️ 10. Error Handling & API Envelopes

### 10.1 Standardized Success Response

Every successful API response adheres to a predictable structure:

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Service requests retrieved successfully.",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  },
  "data": [ ... ]
}
```

### 10.2 Standardized Error Response

Handled centrally by [globalErrorHandler.ts](file:///d:/Code/PH%20Level2%20Assignments/B7A6-CivicFlowAPI/src/app/middleware/globalErrorHandler.ts):

```json
{
  "success": false,
  "message": "Validation Error",
  "errorSources": [
    {
      "path": "priority",
      "message": "Invalid enum value. Expected 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'"
    }
  ],
  "stack": "..." // Only present in development mode (NODE_ENV !== 'production')
}
```

---

## 📄 License & Attribution

This project is developed for the **Programming Hero Level 2 Assessment (B7A6)**.  
All rights reserved. Unauthorized redistribution or commercial duplication is strictly prohibited.
