# CivicFlow API - Postman Testing Guide & Endpoint Reference (`testapi`)

Welcome to the **CivicFlow API Postman Testing Guide**. This document lists every single endpoint, HTTP method, required authorization role, URL parameters, query parameters, request body schemas, and ready-to-test JSON payloads for testing with Postman.

---

## 📑 Table of Contents

1. [Quick Setup & Postman Environment](#1-quick-setup--postman-environment)
2. [Recommended Testing Lifecycle Flow](#2-recommended-testing-lifecycle-flow)
3. [System Enums & Status Transition Rules](#3-system-enums--status-transition-rules)
4. [Endpoint Reference by Module](#4-endpoint-reference-by-module)
   - [4.1 Base Root](#41-base-root)
   - [4.2 Authentication & Profile (`/api/v1/auth`)](#42-authentication--profile-apiv1auth)
   - [4.3 User Management (`/api/v1/user`)](#43-user-management-apiv1user)
   - [4.4 Departments & Routing Rules (`/api/v1/departments`)](#44-departments--routing-rules-apiv1departments)
   - [4.5 Service Requests & Workflow (`/api/v1/requests`)](#45-service-requests--workflow-apiv1requests)
   - [4.6 Evidence & Attachments (`/api/v1/requests/:requestId/attachments`)](#46-evidence--attachments-apiv1requestsrequestidattachments)
   - [4.7 Request Feedback & Analytics (`/api/v1/requests` & `/api/v1/request-feedback`)](#47-request-feedback--analytics-apiv1requests--apiv1request-feedback)
   - [4.8 SLA Management (`/api/v1/sla`)](#48-sla-management-apiv1sla)
   - [4.9 In-App Notifications (`/api/v1/notifications`)](#49-in-app-notifications-apiv1notifications)
   - [4.10 Payments & Invoices (`/api/v1/payment` & `/api/v1/request-payments`)](#410-payments--invoices-apiv1payment--apiv1request-payments)
   - [4.11 Audit Logs (`/api/v1/audit-logs`)](#411-audit-logs-apiv1audit-logs)
   - [4.12 Dashboard & Public Stats (`/api/v1/dashboard`)](#412-dashboard--public-stats-apiv1dashboard)

---

## 1. Quick Setup & Postman Environment

### 1.1 Base URLs
- **Local Development**: `http://localhost:5000`
- **Vercel Production**: `https://<your-project>.vercel.app`

### 1.2 Recommended Postman Environment Variables
Create an Environment in Postman and define these variables:

| Variable Name | Initial / Example Value | Description |
| :--- | :--- | :--- |
| `baseUrl` | `http://localhost:5000` | Server base address |
| `adminToken` | *(set after Admin login)* | Bearer token for ADMIN role |
| `staffToken` | *(set after Staff login)* | Bearer token for STAFF role |
| `citizenToken` | *(set after Citizen login)* | Bearer token for CITIZEN role |
| `token` | `{{adminToken}}` | Active token used in Authorization headers |
| `userId` | `""` | Target user ID for user management tests |
| `departmentId` | `""` | Created department ID |
| `categoryId` | `""` | Request category ID |
| `requestId` | `""` | Created Service Request ID |
| `attachmentId` | `""` | Uploaded attachment ID |
| `paymentId` | `""` | Payment ID |
| `notificationId`| `""` | Notification ID |

### 1.3 Postman Pre-Request / Tests Script (Auto-save Token)
Under the **Tests** tab of your Login / Verify-Email requests in Postman, paste this snippet to automatically store your access token:

```javascript
const response = pm.response.json();
if (response.data && response.data.accessToken) {
    pm.environment.set("token", response.data.accessToken);
    pm.environment.set("refreshToken", response.data.refreshToken);
    console.log("Access token saved to environment!");
}
```

### 1.4 Default Seeded Admin Credentials
On application start (or Vercel serverless cold start), a default Super Admin account is automatically seeded if no admin exists:
- **Email**: `superadmin@example.com` *(or `SUPER_ADMIN_EMAIL` from `.env`)*
- **Password**: `Password@123` *(or `SUPER_ADMIN_PASSWORD` from `.env`)*
- **Role**: `ADMIN`

---

## 2. Recommended Testing Lifecycle Flow

For a complete end-to-end test run in Postman, follow this sequence:

```text
1. [ADMIN] Login -> Save adminToken
2. [ADMIN] Create Department ("Waste Management") -> Save departmentId
3. [ADMIN] Query or create Category -> Save categoryId
4. [ADMIN] Create Category Routing Rule (CategoryId + DepartmentId)
5. [CITIZEN] Register ("citizen@example.com") -> Check OTP in Redis/Email
6. [CITIZEN] Verify Email with OTP -> Save citizenToken
7. [ADMIN] Update a user or create staff -> Assign staff to department -> Save staffToken
8. [CITIZEN] Create Service Request with priority & coordinates -> Save requestId
9. [CITIZEN/ADMIN/STAFF] Upload attachment image to request
10. [STAFF] Fetch Department Queue (`/queue/department`) & My Queue (`/queue/me`)
11. [ADMIN/STAFF] Assign Request to Staff
12. [STAFF] Transition Request: SUBMITTED -> TRIAGED -> IN_PROGRESS
13. [STAFF] Add Investigation Notes
14. [STAFF] Resolve Request (IN_PROGRESS -> RESOLVED)
15. [CITIZEN] Confirm Request (RESOLVED -> CLOSED) or Reopen (RESOLVED -> REOPENED)
16. [CITIZEN] Submit Star Rating & Feedback (1-5)
17. [CITIZEN] Initiate bKash Payment for Service
18. [ADMIN/CITIZEN] View Payment & Generate PDF Invoice
19. [ADMIN] Review SLA overdue list, Audit logs, and Dashboard analytics
```

---

## 3. System Enums & Status Transition Rules

### 3.1 Allowed Enum Values

- **User Roles (`Role`)**: `CITIZEN`, `STAFF`, `ADMIN`
- **User Status (`UserStatus`)**: `ACTIVE`, `BLOCKED`, `DELETED`
- **Case Type (`CaseType`)**: `COMPLAINT`, `SERVICE_REQUEST`
- **Priority (`RequestPriority`)**: `LOW`, `NORMAL`, `HIGH`, `URGENT`
- **Payment Status (`PaymentStatus`)**: `UNPAID`, `PENDING`, `COMPLETED`, `FAILED`, `CANCELLED`, `REFUNDED`
- **SLA Escalation State (`SlaEscalationState`)**: `NONE`, `BREACHED`, `ACKNOWLEDGED`, `ESCALATED`

### 3.2 State Machine Valid Transitions
The API enforces a strict finite state machine for `RequestStatus`:

| Current Status | Allowed Next Statuses | Who Can Perform |
| :--- | :--- | :--- |
| `SUBMITTED` | `TRIAGED`, `REJECTED` | ADMIN, STAFF |
| `TRIAGED` | `ASSIGNED`, `REJECTED`, `ON_HOLD` | ADMIN, STAFF |
| `ASSIGNED` | `IN_PROGRESS`, `ON_HOLD` | ADMIN, STAFF |
| `IN_PROGRESS` | `AWAITING_CITIZEN`, `RESOLVED`, `ON_HOLD` | ADMIN, STAFF |
| `AWAITING_CITIZEN` | `IN_PROGRESS`, `ON_HOLD` | ADMIN, STAFF |
| `RESOLVED` | `CLOSED` (via `/confirm`), `REOPENED` (via `/reopen`) | CITIZEN (owner), ADMIN |
| `CLOSED` | `REOPENED` (within reopening window) | CITIZEN (owner), ADMIN |
| `ON_HOLD` | `TRIAGED`, `IN_PROGRESS` | ADMIN, STAFF |
| `REOPENED` | `IN_PROGRESS`, `ON_HOLD` | ADMIN, STAFF |
| `REJECTED` | *(Terminal state - no transitions)* | - |

---

## 4. Endpoint Reference by Module

---

### 4.1 Base Root

#### 4.1.1 Health / Welcome Check
- **Method**: `GET`
- **URL**: `{{baseUrl}}/`
- **Auth**: None (Public)
- **Expected Status**: `200 OK`
- **Response**:
```json
{
  "success": true,
  "message": "Welcome to CivicFlow."
}
```

---

### 4.2 Authentication & Profile (`/api/v1/auth`)

#### 4.2.1 Register New User
Initiates registration and triggers a 6-digit verification code to Redis & email.
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/auth/register`
- **Auth**: None (Public)
- **Headers**: `Content-Type: application/json`
- **Body** (raw JSON):
```json
{
  "name": "Alex Citizen",
  "email": "alex.citizen@example.com",
  "password": "Password123!"
}
```
*(Password requirement: at least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character).*
- **Expected Status**: `201 Created`

#### 4.2.2 Verify Email with OTP
Finalizes user creation in the database and returns JWT tokens.
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/auth/verify-email`
- **Auth**: None (Public)
- **Headers**: `Content-Type: application/json`
- **Body** (raw JSON):
```json
{
  "email": "alex.citizen@example.com",
  "otp": "123456"
}
```
*(Note: If testing locally without SMTP, check your Redis instance for key `registration:alex.citizen@example.com` or server console logs).*
- **Expected Status**: `201 Created`
- **Response Sample**:
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Email verified successfully.",
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "user": {
      "id": "18f5d07c-9b88-466d-88ff-453086eb022a",
      "name": "Alex Citizen",
      "email": "alex.citizen@example.com",
      "role": "CITIZEN",
      "status": "ACTIVE"
    }
  }
}
```

#### 4.2.3 Login User
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/auth/login`
- **Auth**: None (Public)
- **Headers**: `Content-Type: application/json`
- **Body** (raw JSON):
```json
{
  "email": "superadmin@example.com",
  "password": "Password@123"
}
```
- **Expected Status**: `200 OK`

#### 4.2.4 Get Current User Profile (`/me`)
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/auth/me`
- **Auth**: `Bearer {{token}}`
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Expected Status**: `200 OK`

#### 4.2.5 Google OAuth Login
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/auth/google`
- **Auth**: None (Public)
- **Headers**: `Content-Type: application/json`
- **Body** (raw JSON):
```json
{
  "idToken": "<google_id_token_string>"
}
```
- **Expected Status**: `200 OK`

#### 4.2.6 Refresh Access Token
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/auth/refresh-token`
- **Auth**: Requires `refreshToken` Cookie
- **Headers**:
  - `Cookie`: `refreshToken={{refreshToken}}`
- **Expected Status**: `200 OK`

#### 4.2.7 Forgot Password (Request OTP)
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/auth/forgot-password`
- **Auth**: None (Public)
- **Headers**: `Content-Type: application/json`
- **Body** (raw JSON):
```json
{
  "email": "alex.citizen@example.com"
}
```
- **Expected Status**: `200 OK`

#### 4.2.8 Reset Password with OTP
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/auth/reset-password`
- **Auth**: None (Public)
- **Headers**: `Content-Type: application/json`
- **Body** (raw JSON):
```json
{
  "email": "alex.citizen@example.com",
  "otp": "123456",
  "newPassword": "NewStrongPassword123!"
}
```
- **Expected Status**: `200 OK`

---

### 4.3 User Management (`/api/v1/user`)

#### 4.3.1 Upload Profile Image
- **Method**: `PATCH`
- **URL**: `{{baseUrl}}/api/v1/user/profile-image`
- **Auth**: `Bearer {{token}}` (CITIZEN, ADMIN, STAFF)
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Body**: `form-data`
  - Key: `profileImage` (Type: **File**, select any `.jpg` or `.png` image)
- **Expected Status**: `200 OK`

#### 4.3.2 Get All Users
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/user?page=1&limit=10&role=STAFF&status=ACTIVE`
- **Auth**: `Bearer {{adminToken}}` (ADMIN only)
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
- **Query Parameters**:
  - `page`: `1` (default 1)
  - `limit`: `10` (default 20, max 100)
  - `searchTerm`: `alex` (matches name or email)
  - `role`: `CITIZEN` | `STAFF` | `ADMIN`
  - `status`: `ACTIVE` | `BLOCKED` | `DELETED`
  - `departmentId`: `<uuid>`
- **Expected Status**: `200 OK`

#### 4.3.3 Get User by ID
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/user/{{userId}}`
- **Auth**: `Bearer {{token}}` (ADMIN, STAFF, CITIZEN)
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Expected Status**: `200 OK`

#### 4.3.4 Update User (Role, Status, Department)
- **Method**: `PATCH`
- **URL**: `{{baseUrl}}/api/v1/user/{{userId}}`
- **Auth**: `Bearer {{adminToken}}` (ADMIN only)
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
  - `Content-Type`: `application/json`
- **Body** (raw JSON):
```json
{
  "name": "Jane Technician",
  "role": "STAFF",
  "status": "ACTIVE",
  "departmentId": "{{departmentId}}"
}
```
- **Expected Status**: `200 OK`

#### 4.3.5 Soft Delete User
- **Method**: `DELETE`
- **URL**: `{{baseUrl}}/api/v1/user/{{userId}}`
- **Auth**: `Bearer {{adminToken}}` (ADMIN only)
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
- **Expected Status**: `200 OK`

---

### 4.4 Departments & Routing Rules (`/api/v1/departments`)

#### 4.4.1 List Departments
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/departments?includeArchived=false`
- **Auth**: `Bearer {{adminToken}}` (ADMIN only)
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
- **Query Parameters**:
  - `includeArchived`: `false` (default: false)
- **Expected Status**: `200 OK`

#### 4.4.2 Create Department
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/departments`
- **Auth**: `Bearer {{adminToken}}` (ADMIN only)
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
  - `Content-Type`: `application/json`
- **Body** (raw JSON):
```json
{
  "name": "Waste Management & Sanitation",
  "description": "Handles garbage collection, recycling, drainage clearing, and street cleanliness."
}
```
- **Expected Status**: `201 Created`

#### 4.4.3 Archive Department
- **Method**: `PATCH`
- **URL**: `{{baseUrl}}/api/v1/departments/{{departmentId}}/archive`
- **Auth**: `Bearer {{adminToken}}` (ADMIN only)
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
- **Expected Status**: `200 OK`

#### 4.4.4 Assign Staff Member to Department
- **Method**: `PATCH`
- **URL**: `{{baseUrl}}/api/v1/departments/staff/{{userId}}/department`
- **Auth**: `Bearer {{adminToken}}` (ADMIN only)
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
  - `Content-Type`: `application/json`
- **Body** (raw JSON):
```json
{
  "departmentId": "{{departmentId}}"
}
```
*(Send `{"departmentId": null}` to unassign)*
- **Expected Status**: `200 OK`

#### 4.4.5 List Category Routing Rules
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/departments/routing-rules?includeArchived=false`
- **Auth**: `Bearer {{adminToken}}` (ADMIN only)
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
- **Expected Status**: `200 OK`

#### 4.4.6 Create Category Routing Rule
Automatically routes incoming requests of this category and location to the designated department.
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/departments/routing-rules`
- **Auth**: `Bearer {{adminToken}}` (ADMIN only)
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
  - `Content-Type`: `application/json`
- **Body** (raw JSON):
```json
{
  "categoryId": "{{categoryId}}",
  "departmentId": "{{departmentId}}",
  "location": "Ward 5",
  "priority": 10
}
```
*(Leave `location` omitted for default/fallback rule across all areas).*
- **Expected Status**: `201 Created`

#### 4.4.7 Archive Routing Rule
- **Method**: `PATCH`
- **URL**: `{{baseUrl}}/api/v1/departments/routing-rules/{{ruleId}}/archive`
- **Auth**: `Bearer {{adminToken}}` (ADMIN only)
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
- **Expected Status**: `200 OK`

---

### 4.5 Service Requests & Workflow (`/api/v1/requests`)

#### 4.5.1 Create Service Request
Submit a new civic complaint or service request. Can be sent as JSON or `multipart/form-data` with up to 5 attachments (`files`).
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/requests`
- **Auth**: `Bearer {{citizenToken}}` (CITIZEN, STAFF, ADMIN)
- **Headers**:
  - `Authorization`: `Bearer {{citizenToken}}`
  - `Content-Type`: `application/json`
- **Body** (raw JSON):
```json
{
  "title": "Severe Water Logging on Road 12",
  "description": "After heavy rains the main drainage line has clogged and water has entered pedestrian walkways for over 24 hours.",
  "caseType": "COMPLAINT",
  "priority": "HIGH",
  "location": "Road 12, Block D",
  "address": "House 15, Road 12, Banani",
  "ward": "Ward 19",
  "zone": "North Zone",
  "landmark": "Opposite City Bank ATM",
  "latitude": 23.7937,
  "longitude": 90.4066,
  "categoryId": "{{categoryId}}"
}
```
*(Note: If `latitude` is supplied, `longitude` is also required).*
- **Expected Status**: `201 Created`

#### 4.5.2 List Service Requests
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/requests?page=1&limit=10&status=SUBMITTED&priority=HIGH&sortBy=createdAt&sortOrder=desc`
- **Auth**: `Bearer {{token}}` (CITIZEN sees own requests, STAFF sees own department requests, ADMIN sees all)
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Query Parameters**:
  - `page`: `1`
  - `limit`: `10`
  - `searchTerm`: `water`
  - `status`: `SUBMITTED` | `TRIAGED` | `ASSIGNED` | `IN_PROGRESS` | `AWAITING_CITIZEN` | `RESOLVED` | `CLOSED` | `REJECTED` | `ON_HOLD` | `REOPENED`
  - `caseType`: `COMPLAINT` | `SERVICE_REQUEST`
  - `priority`: `LOW` | `NORMAL` | `HIGH` | `URGENT`
  - `categoryId`: `<uuid>`
  - `departmentId`: `<uuid>`
  - `ward`: `Ward 19`
  - `zone`: `North Zone`
  - `overdue`: `true` | `false`
  - `sortBy`: `createdAt` | `updatedAt` | `priority` | `status` | `title`
  - `sortOrder`: `asc` | `desc`
- **Expected Status**: `200 OK`

#### 4.5.3 Get Single Service Request
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/requests/{{requestId}}`
- **Auth**: `Bearer {{token}}`
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Expected Status**: `200 OK`

#### 4.5.4 Update Service Request Details
- **Method**: `PATCH`
- **URL**: `{{baseUrl}}/api/v1/requests/{{requestId}}`
- **Auth**: `Bearer {{token}}`
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
  - `Content-Type`: `application/json`
- **Body** (raw JSON):
```json
{
  "title": "Severe Water Logging - Road 12 Drain Overflow",
  "priority": "URGENT",
  "landmark": "Near Banani Supermarket"
}
```
- **Expected Status**: `200 OK`

#### 4.5.5 Staff My Assigned Queue
Returns requests specifically assigned to the currently logged in staff member.
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/requests/queue/me?page=1&limit=10&status=IN_PROGRESS`
- **Auth**: `Bearer {{staffToken}}` (STAFF only)
- **Headers**:
  - `Authorization`: `Bearer {{staffToken}}`
- **Query Parameters**: `page`, `limit`, `searchTerm`, `status`, `priority`, `overdue`, `sortBy`, `sortOrder`
- **Expected Status**: `200 OK`

#### 4.5.6 Department Queue
Returns all requests assigned to the staff member's department.
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/requests/queue/department?page=1&limit=10`
- **Auth**: `Bearer {{staffToken}}` (STAFF only)
- **Headers**:
  - `Authorization`: `Bearer {{staffToken}}`
- **Expected Status**: `200 OK`

#### 4.5.7 Transition Request Status
Moves a request through the state machine lifecycle.
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/requests/{{requestId}}/transition`
- **Auth**: `Bearer {{token}}` (ADMIN or assigned STAFF)
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
  - `Content-Type`: `application/json`
- **Body** (raw JSON):
```json
{
  "status": "TRIAGED",
  "reason": "Request inspected by desk officer. Scheduled for on-site crew dispatch."
}
```
- **Expected Status**: `200 OK`

#### 4.5.8 Add Investigation Note
Appends internal operational notes to the request history.
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/requests/{{requestId}}/notes`
- **Auth**: `Bearer {{token}}` (ADMIN or department STAFF)
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
  - `Content-Type`: `application/json`
- **Body** (raw JSON):
```json
{
  "note": "Excavation team arrived at site. Found main drainage pipe blocked by construction debris."
}
```
- **Expected Status**: `201 Created`

#### 4.5.9 Resolve Service Request
Marks the request as resolved and records the official resolution summary.
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/requests/{{requestId}}/resolve`
- **Auth**: `Bearer {{token}}` (ADMIN or assigned STAFF)
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
  - `Content-Type`: `application/json`
- **Body** (raw JSON):
```json
{
  "reason": "Debris completely cleared using vacuum excavator. Normal drainage flow restored and verified."
}
```
- **Expected Status**: `200 OK`

#### 4.5.10 Citizen Confirm Resolution (Close Request)
Citizen confirms the work is satisfactory, moving the request from `RESOLVED` to `CLOSED`.
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/requests/{{requestId}}/confirm`
- **Auth**: `Bearer {{citizenToken}}` (CITIZEN - request creator)
- **Headers**:
  - `Authorization`: `Bearer {{citizenToken}}`
  - `Content-Type`: `application/json`
- **Body**: `{}`
- **Expected Status**: `200 OK`

#### 4.5.11 Citizen Reopen Request
Citizen reopens an unsatisfactory resolution within the allowed window.
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/requests/{{requestId}}/reopen`
- **Auth**: `Bearer {{citizenToken}}` (CITIZEN - request creator)
- **Headers**:
  - `Authorization`: `Bearer {{citizenToken}}`
  - `Content-Type`: `application/json`
- **Body** (raw JSON):
```json
{
  "reason": "Water logging returned immediately after today's shower. Drainage line remains choked."
}
```
- **Expected Status**: `200 OK`

#### 4.5.12 Automatic Route Service Request
Runs category and location routing rules to link the request to its target department.
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/requests/{{requestId}}/route`
- **Auth**: `Bearer {{adminToken}}` (ADMIN only)
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
- **Expected Status**: `200 OK`

#### 4.5.13 Assign Request to Staff
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/requests/{{requestId}}/assign`
- **Auth**: `Bearer {{token}}` (ADMIN or STAFF in same department)
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
  - `Content-Type`: `application/json`
- **Body** (raw JSON):
```json
{
  "assignedToId": "{{staffUserId}}"
}
```
- **Expected Status**: `200 OK`

#### 4.5.14 Reassign Request to Another Staff
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/requests/{{requestId}}/reassign`
- **Auth**: `Bearer {{token}}` (ADMIN or STAFF in same department)
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
  - `Content-Type`: `application/json`
- **Body** (raw JSON):
```json
{
  "assignedToId": "{{newStaffUserId}}"
}
```
- **Expected Status**: `200 OK`

#### 4.5.15 Soft Delete Request
- **Method**: `DELETE`
- **URL**: `{{baseUrl}}/api/v1/requests/{{requestId}}`
- **Auth**: `Bearer {{token}}` (CITIZEN owner, STAFF, ADMIN)
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Expected Status**: `200 OK`

---

### 4.6 Evidence & Attachments (`/api/v1/requests/:requestId/attachments`)

#### 4.6.1 Add Evidence Attachment
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/requests/{{requestId}}/attachments`
- **Auth**: `Bearer {{token}}` (CITIZEN owner, STAFF, ADMIN)
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Body**: `form-data`
  - `file`: (Type: **File**, select an image or PDF)
  - `caption`: `"Site condition photo after rainfall"` (Type: Text)
- **Expected Status**: `201 Created`

#### 4.6.2 List Request Attachments
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/requests/{{requestId}}/attachments`
- **Auth**: `Bearer {{token}}`
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Expected Status**: `200 OK`

#### 4.6.3 Get Single Attachment Details
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/requests/{{requestId}}/attachments/{{attachmentId}}`
- **Auth**: `Bearer {{token}}`
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Expected Status**: `200 OK`

#### 4.6.4 Delete Attachment
- **Method**: `DELETE`
- **URL**: `{{baseUrl}}/api/v1/requests/{{requestId}}/attachments/{{attachmentId}}`
- **Auth**: `Bearer {{token}}`
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Expected Status**: `200 OK`

---

### 4.7 Request Feedback & Analytics (`/api/v1/requests` & `/api/v1/request-feedback`)

#### 4.7.1 Submit Feedback for Request
Citizen rates completed service (1 to 5 stars).
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/requests/{{requestId}}/feedback`
- **Auth**: `Bearer {{citizenToken}}` (CITIZEN - request creator)
- **Headers**:
  - `Authorization`: `Bearer {{citizenToken}}`
  - `Content-Type`: `application/json`
- **Body** (raw JSON):
```json
{
  "rating": 5,
  "comment": "Outstanding response! The drainage crew completed the job cleanly within hours."
}
```
- **Expected Status**: `201 Created`

#### 4.7.2 Get Feedback for Request
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/requests/{{requestId}}/feedback`
- **Auth**: `Bearer {{token}}` (CITIZEN owner or ADMIN)
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Expected Status**: `200 OK`

#### 4.7.3 Feedback Analytics & Report
Admin overview of all citizen feedback and ratings.
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/request-feedback/report?rating=5&page=1&limit=20`
- **Auth**: `Bearer {{adminToken}}` (ADMIN only)
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
- **Query Parameters**:
  - `rating`: `1` to `5`
  - `status`: `RESOLVED` | `CLOSED`
  - `categoryId`: `<uuid>`
  - `departmentId`: `<uuid>`
  - `from`: `2026-01-01`
  - `to`: `2026-12-31`
  - `searchTerm`: `outstanding`
  - `page`: `1`
  - `limit`: `20`
- **Expected Status**: `200 OK`

---

### 4.8 SLA Management (`/api/v1/sla`)

#### 4.8.1 List Overdue Requests
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/sla/overdue?page=1&limit=20`
- **Auth**: `Bearer {{token}}` (ADMIN or STAFF)
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Query Parameters**:
  - `departmentId`: `<uuid>`
  - `categoryId`: `<uuid>`
  - `page`: `1`
  - `limit`: `20`
- **Expected Status**: `200 OK`

#### 4.8.2 Configure Category SLA Duration
Sets SLA target resolution time in minutes for a specific category.
- **Method**: `PATCH`
- **URL**: `{{baseUrl}}/api/v1/sla/categories/{{categoryId}}`
- **Auth**: `Bearer {{adminToken}}` (ADMIN only)
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
  - `Content-Type`: `application/json`
- **Body** (raw JSON):
```json
{
  "slaMinutes": 2880
}
```
*(2880 minutes = 48 hours. Min: 1, Max: 525600 minutes / 1 year).*
- **Expected Status**: `200 OK`

#### 4.8.3 Escalate Overdue Request
Triggers high-priority escalation and supervisor notifications for breached or delayed requests.
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/sla/requests/{{requestId}}/escalate`
- **Auth**: `Bearer {{token}}` (ADMIN or STAFF)
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Expected Status**: `200 OK`

#### 4.8.4 Process SLA Breaches (Batch Worker Trigger)
Evaluates all active requests against due dates, transitions state, and dispatches breach alerts.
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/sla/process`
- **Auth**: `Bearer {{adminToken}}` (ADMIN only)
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
  - `Content-Type`: `application/json`
- **Body** (raw JSON):
```json
{
  "limit": 100
}
```
- **Expected Status**: `200 OK`

---

### 4.9 In-App Notifications (`/api/v1/notifications`)

#### 4.9.1 List My Notifications
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/notifications?page=1&limit=20`
- **Auth**: `Bearer {{token}}` (Any authenticated user)
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Query Parameters**:
  - `page`: `1`
  - `limit`: `20`
- **Expected Status**: `200 OK`

#### 4.9.2 Get Unread Notification Count
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/notifications/unread-count`
- **Auth**: `Bearer {{token}}`
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Expected Status**: `200 OK`
- **Response Sample**:
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Unread notification count retrieved successfully.",
  "data": {
    "count": 3
  }
}
```

#### 4.9.3 Mark Notification as Read
- **Method**: `PATCH`
- **URL**: `{{baseUrl}}/api/v1/notifications/{{notificationId}}/read`
- **Auth**: `Bearer {{token}}`
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Expected Status**: `200 OK`

---

### 4.10 Payments & Invoices (`/api/v1/payment` & `/api/v1/request-payments`)

#### 4.10.1 Initiate Request Payment (bKash Gateway)
Creates a bKash checkout session for fee-eligible civic requests.
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/v1/request-payments/requests/{{requestId}}/initiate`
- **Auth**: `Bearer {{citizenToken}}` (CITIZEN - request creator)
- **Headers**:
  - `Authorization`: `Bearer {{citizenToken}}`
- **Expected Status**: `200 OK`
- **Response Sample**:
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Request payment initiated successfully.",
  "data": {
    "id": "7f0a99be-7589-4a4b-9e45-bf21f0088cb3",
    "amount": 500,
    "currency": "BDT",
    "status": "PENDING",
    "merchantInvoiceNumber": "INV-1711467890",
    "bkashUrl": "https://sandbox.payment.bkash.com/redirect/tokenized/..."
  }
}
```

#### 4.10.2 Get Request Payment Status
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/request-payments/{{paymentId}}/status`
- **Auth**: `Bearer {{token}}` (ADMIN, STAFF, CITIZEN)
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Expected Status**: `200 OK`

#### 4.10.3 bKash Payment Callback / Webhook Reconciler
Simulate or receive bKash payment execution callbacks (`success`, `cancel`, or `failure`).
- **Method**: `GET` or `POST`
- **URL**: `{{baseUrl}}/api/v1/request-payments/bkash/callback/success?paymentID=<bkash_payment_id>`
- **Auth**: None (Public webhook)
- **URL Param `result`**: `success` | `cancel` | `failure`
- **Query Parameter / Body**:
  - `paymentID`: `TR001122334455`
- **Expected Status**: `200 OK`

#### 4.10.4 Get My Payments (Citizen History)
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/payment/my-payments?page=1&limit=10`
- **Auth**: `Bearer {{citizenToken}}` (CITIZEN only)
- **Headers**:
  - `Authorization`: `Bearer {{citizenToken}}`
- **Expected Status**: `200 OK`

#### 4.10.5 Get All System Payments (Admin Audit)
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/payment/all-payments?page=1&limit=20`
- **Auth**: `Bearer {{adminToken}}` (ADMIN only)
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
- **Expected Status**: `200 OK`

#### 4.10.6 Get Single Payment Details
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/payment/{{paymentId}}`
- **Auth**: `Bearer {{token}}` (ADMIN, STAFF, CITIZEN)
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Expected Status**: `200 OK`

#### 4.10.7 Generate & Retrieve Payment PDF Invoice
Generates a PDF receipt, uploads to Cloudinary, and returns the public download link.
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/payment/{{paymentId}}/invoice`
- **Auth**: `Bearer {{token}}` (ADMIN, STAFF, CITIZEN)
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Expected Status**: `200 OK`
- **Response Sample**:
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Invoice retrieved successfully.",
  "data": {
    "invoiceUrl": "https://res.cloudinary.com/your-cloud/raw/upload/v12345/civicflow/invoices/...",
    "invoicePublicId": "civicflow/invoices/..."
  }
}
```

---

### 4.11 Audit Logs (`/api/v1/audit-logs`)

#### 4.11.1 Search & Filter Audit Trail
Inspect all system events including status changes, assignments, user modifications, and payments.
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/audit-logs?page=1&limit=20&sortOrder=desc`
- **Auth**: `Bearer {{adminToken}}` (ADMIN only)
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
- **Query Parameters**:
  - `page`: `1` (default 1)
  - `limit`: `20` (max 100)
  - `actorId`: `<uuid>`
  - `action`: `REQUEST_CREATED` | `REQUEST_STATUS_CHANGED` | `STAFF_DEPARTMENT_ASSIGNED` | `USER_ROLE_CHANGED` | `PAYMENT_INITIATED` | `PAYMENT_RECONCILED`
  - `entity`: `ServiceRequest` | `User` | `Department` | `Payment`
  - `entityId`: `<uuid>`
  - `from`: `2026-01-01`
  - `to`: `2026-12-31`
  - `sortOrder`: `desc` | `asc`
- **Expected Status**: `200 OK`

---

### 4.12 Dashboard & Public Stats (`/api/v1/dashboard`)

#### 4.12.1 Admin Comprehensive Analytics Dashboard
Aggregates platform KPIs, SLA compliance rates, department workloads, and category breakdowns.
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/dashboard/admin`
- **Auth**: `Bearer {{adminToken}}` (ADMIN only)
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
- **Query Parameters**:
  - `departmentId`: `<uuid>` (optional: filter by specific department)
  - `from`: `2026-01-01`
  - `to`: `2026-12-31`
- **Expected Status**: `200 OK`

#### 4.12.2 Public Transparency Statistics
Open endpoint showing public statistics (resolved count, total complaints, active departments).
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/v1/dashboard/public/stats`
- **Auth**: None (Public)
- **Expected Status**: `200 OK`
- **Response Sample**:
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Public statistics retrieved successfully.",
  "data": {
    "totalRequests": 128,
    "resolvedRequests": 112,
    "activeDepartments": 8
  }
}
```

---

## 5. Postman Troubleshooting Tips

1. **`401 Unauthorized` / "Authentication is required."**
   - Ensure the `Authorization` header is present with `Bearer <your_token>`.
   - Make sure your token has not expired (`1d` expiration by default).
2. **`403 Forbidden` / "You are not authorized to perform this action."**
   - Verify that your user role matches the required role for the endpoint (e.g. `ADMIN` for `/api/v1/departments`, `CITIZEN` for `/api/v1/requests/:requestId/confirm`).
3. **`400 Bad Request` on Service Request Creation**
   - If providing `latitude`, ensure `longitude` is also included. Both coordinates must be sent together or both omitted.
4. **File Uploads (`multipart/form-data`)**
   - In Postman, switch body type to `form-data`, hover over the key input, and select **File** in the dropdown.
   - For `/api/v1/user/profile-image`, key name must be `profileImage`.
   - For `/api/v1/requests` initial files, key name must be `files`.
   - For `/api/v1/requests/:requestId/attachments`, key name must be `file`.
5. **State Transition `400` / Invalid Transition**
   - Refer to Section 3.2 for the valid state machine chart. A request cannot jump directly from `SUBMITTED` to `RESOLVED`; it must follow `SUBMITTED -> TRIAGED -> ASSIGNED / IN_PROGRESS -> RESOLVED`.
