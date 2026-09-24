# AGENT INSTRUCTION & REUSABLE BACKEND BLUEPRINT (`agents.md`)

> **Note for AI Agents:**
> You are acting as an expert Senior Backend Engineer building a production-ready Node.js, Express, TypeScript, and Prisma backend. When scaffolding or adding features to a project, **strictly follow the architecture, design patterns, folder structure, code conventions, and reusable modules documented in this file.**

---

## 1. System Architecture & Tech Stack

This architecture is built for scalability, strict type-safety, maintainability, and clean separation of concerns.

- **Runtime & Language:** Node.js (v20+), TypeScript (`esnext`, `moduleResolution: bundler`, strict mode)
- **Web Framework:** Express v5
- **ORM & Database:** Prisma v7 (`prisma.config.ts` multi-file schema, PostgreSQL with `@prisma/adapter-pg` pool adapter)
- **Validation:** Zod v3/v4 (strict request validation middleware)
- **Authentication:** JWT (Access + Refresh Token rotation), HTTP-only cookies, Bearer header support, Role-Based Access Control (RBAC), Google OAuth2 (`google-auth-library`)
- **Cache & Ephemeral Storage:** Redis (OTP caching with TTL, session storage, payment token caching)
- **Media & File Handling:** Multer (memory storage) + Cloudinary (stream upload, old asset cleanup)
- **Mailing:** Nodemailer (SMTP/Gmail) + EJS responsive HTML templates
- **Tooling & Linter:** Biome (linter + formatter), TSX (hot-reloading in development)

---

## 2. Directory Structure Convention

Every project following this blueprint adheres to the following layout:

```text
├── .env.example
├── .gitignore
├── biome.json
├── package.json
├── prisma.config.ts
├── tsconfig.json
├── prisma/
│   ├── migrations/
│   └── schema/
│       ├── schema.prisma        # generator and datasource configuration
│       ├── enums.prisma         # shared enums (Role, Status, Gender, etc.)
│       ├── user.prisma          # core user model
│       └── <domain>.prisma      # domain models (e.g., patient, product, order)
└── src/
    ├── app.ts                   # Express app setup, CORS, parser, routes, error handler
    ├── server.ts                # Database connect, Redis connect, seeders, HTTP listener
    └── app/
        ├── config/
        │   └── index.ts         # Centralized environment variable loader
        ├── lib/
        │   ├── prisma.ts        # PrismaClient singleton with adapter
        │   ├── redis.ts         # Redis client singleton
        │   ├── nodemailer.ts    # Nodemailer transporter
        │   ├── multer.ts        # Multer memory storage configuration
        │   ├── cloudinary.ts    # Cloudinary configuration & helpers
        │   ├── googleAuth.ts    # Google OAuth2 client
        │   └── bkash.ts         # Payment gateway integration (optional)
        ├── middleware/
        │   ├── checkAuth.ts     # JWT verification & RBAC guard
        │   ├── validateRequest.ts# Zod validation middleware
        │   ├── globalErrorHandler.ts # Centralized error handler (Prisma, Zod, AppError)
        │   └── notFound.ts      # 404 Route Not Found middleware
        ├── utils/
        │   ├── AppError.ts      # Standardized operational error class
        │   ├── catchAsync.ts    # Async wrapper for Express handlers
        │   ├── sendResponse.ts  # Standardized JSON response envelope
        │   ├── jwt.ts           # JWT sign & verify utilities
        │   └── seed.ts          # Idempotent super-admin / default role seeder
        ├── templates/           # EJS HTML email templates
        │   ├── registrationOTP.ejs
        │   ├── patient-welcome-email.ejs
        │   ├── forgot-password.ejs
        │   └── reset-password-success.ejs
        └── module/              # Feature modules (Modular Layered Architecture)
            ├── auth/
            │   ├── auth.interface.ts
            │   ├── auth.validation.ts
            │   ├── auth.controller.ts
            │   ├── auth.service.ts
            │   └── auth.route.ts
            └── <feature>/       # e.g., user, doctor, appointment, product
                ├── <feature>.interface.ts
                ├── <feature>.validation.ts
                ├── <feature>.controller.ts
                ├── <feature>.service.ts
                └── <feature>.route.ts
```

---

## 3. Strict Development Rules for Agents

1. **Layer Responsibilities:**
   - **Routes:** Route definitions, middleware attachment (`validateRequest`, `auth`, `multer`).
   - **Controllers:** Read `req.body`, `req.params`, `req.query`, and `req.user`. Call Service methods. Send response via `sendResponse`. **Never write Prisma queries in controllers.**
   - **Services:** Contain business logic, database transactions, caching, external API calls. **Never touch `req` or `res` inside services.**
   - **Interfaces:** TypeScript types for payloads, filters, options.
   - **Validations:** Zod schemas for all request inputs (body, query, params).
2. **Always Wrap Controllers with `catchAsync`:**
   No controller should have `try/catch` blocks unless doing explicit local error suppression or rollback. Throw errors or let rejections bubble up to `globalErrorHandler`.
3. **Always Format API Responses with `sendResponse`:**
   All successful endpoints must return:
   ```json
   {
     "success": true,
     "statusCode": 200,
     "message": "Descriptive message",
     "data": {},
     "meta": { "page": 1, "limit": 10, "total": 100, "totalPages": 10 }
   }
   ```
4. **Never Spread `req.body` Raw into Database Calls:**
   Always destructure expected fields or rely on sanitized `req.body` produced by `validateRequest(ZodSchema)`.
5. **Use Redis for Ephemeral State:**
   Registration OTPs, password reset OTPs, and temporary registration payloads must live in Redis with a TTL (e.g., 5 minutes) rather than polluting Postgres tables with unverified junk rows.

---

## 4. Reusable Core Utilities

### 4.1. `AppError.ts` (`src/app/utils/AppError.ts`)
```ts
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(statusCode: number, message: string, stack = "") {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
```

### 4.2. `catchAsync.ts` (`src/app/utils/catchAsync.ts`)
```ts
import type { NextFunction, Request, RequestHandler, Response } from "express";

export const catchAsync = (fn: RequestHandler) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};
```

### 4.3. `sendResponse.ts` (`src/app/utils/sendResponse.ts`)
```ts
import type { Response } from "express";

export type TMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type TResponseData<T> = {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta?: TMeta;
};

export const sendResponse = <T>(res: Response, data: TResponseData<T>) => {
  res.status(data.statusCode).json({
    success: data.success,
    statusCode: data.statusCode,
    message: data.message,
    data: data.data,
    meta: data.meta,
  });
};
```

### 4.4. `jwt.ts` (`src/app/utils/jwt.ts`)
```ts
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

const createToken = (
  payload: JwtPayload,
  secret: string,
  expiresIn: string | number,
): string => {
  return jwt.sign(payload, secret, {
    expiresIn,
  } as SignOptions);
};

const verifyToken = (token: string, secret: string) => {
  try {
    const verifiedToken = jwt.verify(token, secret);
    return {
      success: true as const,
      data: verifiedToken as JwtPayload,
    };
  } catch (error: any) {
    return {
      success: false as const,
      error: error.message,
    };
  }
};

export const jwtUtils = {
  createToken,
  verifyToken,
};
```

---

## 5. Reusable Core Middlewares

### 5.1. `validateRequest.ts` (`src/app/middleware/validateRequest.ts`)
```ts
import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { catchAsync } from "../utils/catchAsync";

export const validateRequest = (zodSchema: ZodTypeAny) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const result = await zodSchema.safeParseAsync(req.body ?? {});

    if (!result.success) {
      next(result.error);
      return;
    }

    req.body = result.data;
    next();
  });
};
```

### 5.2. `checkAuth.ts` (`src/app/middleware/checkAuth.ts`)
```ts
import type { NextFunction, Request, Response } from "express";
import type { JwtPayload } from "jsonwebtoken";
import httpStatus from "http-status";
import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";
import { jwtUtils } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        name: string;
        role: string;
      };
    }
  }
}

export const auth = (...requiredRoles: string[]) => {
  return catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const token =
      req.cookies?.accessToken ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : req.headers.authorization);

    if (!token) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        "You are not logged in. Please log in to access this resource.",
      );
    }

    const verifiedToken = jwtUtils.verifyToken(token, config.jwt_access_secret);

    if (!verifiedToken.success || !verifiedToken.data) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Invalid or expired access token.");
    }

    const { userId, email, name, role } = verifiedToken.data as JwtPayload;

    if (requiredRoles.length > 0 && !requiredRoles.includes(role)) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Forbidden: You do not have permission to access this resource.",
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(httpStatus.UNAUTHORIZED, "User account does not exist.");
    }

    if (user.status === "BLOCKED") {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Your account has been blocked. Please contact support.",
      );
    }

    if (user.isDeleted || user.status === "DELETED") {
      throw new AppError(httpStatus.FORBIDDEN, "This account has been deleted.");
    }

    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    next();
  });
};
```

### 5.3. `globalErrorHandler.ts` (`src/app/middleware/globalErrorHandler.ts`)
```ts
import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client";
import config from "../config";
import { AppError } from "../utils/AppError";

export const globalErrorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let message: string = err.message || "Internal Server Error";
  let errorSources: Array<{ path: string | number; message: string }> = [];

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ZodError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Validation Error";
    errorSources = err.issues.map((issue) => ({
      path: issue.path[issue.path.length - 1] ?? "",
      message: issue.message,
    }));
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Incorrect field types or missing required fields in database query.";
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      statusCode = httpStatus.CONFLICT;
      const target = (err.meta?.target as string[]) || [];
      message = `Duplicate key error: Field (${target.join(", ")}) already exists.`;
    } else if (err.code === "P2003") {
      statusCode = httpStatus.BAD_REQUEST;
      message = "Foreign key constraint failed.";
    } else if (err.code === "P2025") {
      statusCode = httpStatus.NOT_FOUND;
      message = "Record not found.";
    }
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    if (err.errorCode === "P1000") {
      statusCode = httpStatus.UNAUTHORIZED;
      message = "Database authentication failed. Please check credentials.";
    } else if (err.errorCode === "P1001") {
      statusCode = httpStatus.SERVICE_UNAVAILABLE;
      message = "Cannot reach database server. Please check connectivity.";
    }
  } else if (err?.name === "JsonWebTokenError") {
    statusCode = httpStatus.UNAUTHORIZED;
    message = "Invalid token. Please authenticate.";
  } else if (err?.name === "TokenExpiredError") {
    statusCode = httpStatus.UNAUTHORIZED;
    message = "Token has expired. Please log in again.";
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errorSources: errorSources.length > 0 ? errorSources : undefined,
    stack: config.node_env === "development" ? err.stack : undefined,
    error: config.node_env === "development" ? err : undefined,
  });
};
```

### 5.4. `notFound.ts` (`src/app/middleware/notFound.ts`)
```ts
import type { Request, Response } from "express";
import httpStatus from "http-status";

export const notFound = (req: Request, res: Response) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    statusCode: httpStatus.NOT_FOUND,
    message: "Route Not Found",
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
};
```

---

## 6. Shared Infrastructure & Library Modules (`src/app/lib/`)

### 6.1. `prisma.ts` (`src/app/lib/prisma.ts`)
```ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });
```

### 6.2. `redis.ts` (`src/app/lib/redis.ts`)
```ts
import { createClient } from "redis";
import config from "../config";

export const redisClient = createClient({
  username: config.redis_user,
  password: config.redis_password,
  socket: {
    host: config.redis_host,
    port: Number(config.redis_port),
  },
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));
```

### 6.3. `nodemailer.ts` (`src/app/lib/nodemailer.ts`)
```ts
import nodemailer from "nodemailer";
import config from "../config";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: config.smtp_user,
    pass: config.smtp_password,
  },
});
```

### 6.4. `multer.ts` (`src/app/lib/multer.ts`)
```ts
import multer from "multer";

const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});
```

### 6.5. `cloudinary.ts` (`src/app/lib/cloudinary.ts`)
```ts
import { type UploadApiResponse, v2 as cloudinary } from "cloudinary";
import config from "../config";

cloudinary.config({
  cloud_name: config.cloudinary_cloud_name,
  api_key: config.cloudinary_api_key,
  api_secret: config.cloudinary_api_secret,
});

export const uploadToCloudinary = (
  buffer: Buffer,
  folder = "uploads",
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { resource_type: "auto", folder },
        (error, result) => {
          if (error || !result) {
            return reject(error || new Error("Failed to upload image to Cloudinary"));
          }
          resolve(result);
        },
      )
      .end(buffer);
  });
};

export const deleteFromCloudinary = async (publicId: string) => {
  if (publicId) {
    await cloudinary.uploader.destroy(publicId);
  }
};

export { cloudinary };
```

### 6.6. `googleAuth.ts` (`src/app/lib/googleAuth.ts`)
```ts
import { OAuth2Client } from "google-auth-library";
import config from "../config";

export const googleClient = new OAuth2Client({
  clientId: config.google_client_id,
});
```

---

## 7. Central Config & Environment Specification

### 7.1. `src/app/config/index.ts`
```ts
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  node_env: process.env.NODE_ENV || "development",
  port: process.env.PORT || 5000,
  database_url: process.env.DATABASE_URL!,
  frontend_url: process.env.FRONTEND_URL || "http://localhost:3000",
  backend_url: process.env.BACKEND_URL || "http://localhost:5000",
  bcrypt_salt_rounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
  jwt_access_secret: process.env.JWT_ACCESS_SECRET!,
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET!,
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN || "1d",
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  google_client_id: process.env.GOOGLE_CLIENT_ID || "",
  super_admin_name: process.env.SUPER_ADMIN_NAME || "Super Admin",
  super_admin_email: process.env.SUPER_ADMIN_EMAIL || "superadmin@domain.com",
  super_admin_password: process.env.SUPER_ADMIN_PASSWORD || "SuperSecret123!",
  redis_user: process.env.REDIS_USER,
  redis_password: process.env.REDIS_PASSWORD,
  redis_host: process.env.REDIS_HOST || "localhost",
  redis_port: process.env.REDIS_PORT || 6379,
  smtp_user: process.env.SMTP_USER,
  smtp_password: process.env.SMTP_PASSWORD,
  email_sender: process.env.EMAIL_SENDER,
  cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET,
};
```

### 7.2. `.env.example`
```env
NODE_ENV=development
PORT=5000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/my_app_db?schema=public"

JWT_ACCESS_SECRET=your_super_secret_access_jwt_key_at_least_32_chars
JWT_REFRESH_SECRET=your_super_secret_refresh_jwt_key_at_least_32_chars
JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d

BCRYPT_SALT_ROUNDS=10
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000

SUPER_ADMIN_NAME="Super Admin"
SUPER_ADMIN_EMAIL="superadmin@domain.com"
SUPER_ADMIN_PASSWORD="Password@123"

REDIS_USER=default
REDIS_PASSWORD=your_redis_password
REDIS_HOST=localhost
REDIS_PORT=6379

SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_gmail_app_password
EMAIL_SENDER="Your App <your_email@gmail.com>"

GOOGLE_CLIENT_ID=your_google_oauth_client_id

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## 8. Prisma Multi-File Schema Configuration

### 8.1. `prisma.config.ts` (Root)
```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

### 8.2. `prisma/schema/schema.prisma`
```prisma
generator client {
  provider = "prisma-client"
  output   = "../../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

### 8.3. `prisma/schema/enums.prisma`
```prisma
enum Role {
  SUPER_ADMIN
  ADMIN
  USER
}

enum UserStatus {
  ACTIVE
  BLOCKED
  DELETED
}

enum AuthProvider {
  CREDENTIAL
  GOOGLE
}
```

### 8.4. `prisma/schema/user.prisma`
```prisma
model User {
  id                 String       @id @default(uuid())
  name               String
  email              String       @unique
  password           String?
  googleId           String?      @unique
  authProvider       AuthProvider @default(CREDENTIAL)
  emailVerified      Boolean      @default(false)
  role               Role         @default(USER)
  status             UserStatus   @default(ACTIVE)
  needPasswordChange Boolean      @default(false)
  imageUrl           String       @default("")
  imagePublicId      String       @default("")
  isDeleted          Boolean      @default(false)
  deletedAt          DateTime?
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt

  @@map("users")
}
```

---

## 9. Complete Production Auth Module Blueprint

### 9.1. `auth.interface.ts`
```ts
export interface IRegisterUserPayload {
  name: string;
  email: string;
  password: string;
}

export interface IVerifyEmailPayload {
  email: string;
  otp: string;
}

export interface ILoginUserPayload {
  email: string;
  password: string;
}

export interface IGoogleLoginPayload {
  idToken: string;
}

export interface IForgotPasswordPayload {
  email: string;
}

export interface IResetPasswordPayload {
  email: string;
  newPassword: string;
  otp: string;
}

export interface IRequestUser {
  userId: string;
  email: string;
  name: string;
  role: string;
}
```

### 9.2. `auth.validation.ts`
```ts
import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
  .regex(/[0-9]/, "Password must include at least one number.")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one special character.");

const RegisterZodSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(60),
  email: z.string().email("Invalid email address format"),
  password: passwordSchema,
});

const VerifyEmailZodSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z.string().length(6, "OTP must be exactly 6 digits"),
});

const LoginZodSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const ForgotPasswordZodSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const ResetPasswordZodSchema = z.object({
  email: z.string().email("Invalid email address"),
  newPassword: passwordSchema,
  otp: z.string().length(6, "OTP must be exactly 6 digits"),
});

export const AuthValidation = {
  RegisterZodSchema,
  VerifyEmailZodSchema,
  LoginZodSchema,
  ForgotPasswordZodSchema,
  ResetPasswordZodSchema,
};
```

### 9.3. `auth.service.ts`
```ts
import crypto from "crypto";
import path from "path";
import bcrypt from "bcryptjs";
import ejs from "ejs";
import httpStatus from "http-status";
import type { SignOptions } from "jsonwebtoken";
import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import { AppError } from "../../utils/AppError";
import { jwtUtils } from "../../utils/jwt";
import type {
  IForgotPasswordPayload,
  IGoogleLoginPayload,
  ILoginUserPayload,
  IRegisterUserPayload,
  IRequestUser,
  IResetPasswordPayload,
  IVerifyEmailPayload,
} from "./auth.interface";

const OTP_EXPIRY_SECONDS = 5 * 60; // 5 minutes

const registerUser = async (payload: IRegisterUserPayload) => {
  const email = payload.email.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    throw new AppError(httpStatus.CONFLICT, "User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(payload.password, config.bcrypt_salt_rounds);
  const otp = crypto.randomInt(100000, 999999).toString();

  const otpKey = `registration-otp:${email}`;
  const dataKey = `registration-data:${email}`;

  await redisClient.set(otpKey, otp, { EX: OTP_EXPIRY_SECONDS });
  await redisClient.set(
    dataKey,
    JSON.stringify({ name: payload.name, email, password: hashedPassword }),
    { EX: OTP_EXPIRY_SECONDS },
  );

  const templatePath = path.join(process.cwd(), "src/app/templates/registrationOTP.ejs");
  const html = await ejs.renderFile(templatePath, {
    otpValue: otp,
    APP_NAME: "My App",
    USER_NAME: payload.name,
    EXPIRY_MINUTES: OTP_EXPIRY_SECONDS / 60,
    CURRENT_YEAR: new Date().getFullYear(),
  });

  await transporter.sendMail({
    from: config.email_sender,
    to: email,
    subject: "Email Verification Code",
    html,
  });
};

const verifyEmail = async (payload: IVerifyEmailPayload) => {
  const email = payload.email.trim().toLowerCase();
  const otpKey = `registration-otp:${email}`;
  const dataKey = `registration-data:${email}`;

  const storedOtp = await redisClient.get(otpKey);
  if (!storedOtp || storedOtp !== payload.otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired verification OTP.");
  }

  const pendingDataStr = await redisClient.get(dataKey);
  if (!pendingDataStr) {
    throw new AppError(httpStatus.BAD_REQUEST, "Registration session expired. Please register again.");
  }

  const pendingData = JSON.parse(pendingDataStr);

  const newUser = await prisma.user.create({
    data: {
      name: pendingData.name,
      email: pendingData.email,
      password: pendingData.password,
      role: "USER" as any,
      emailVerified: true,
    },
    omit: { password: true },
  });

  await redisClient.del([otpKey, dataKey]);

  const jwtPayload = {
    userId: newUser.id,
    email: newUser.email,
    name: newUser.name,
    role: newUser.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );
  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return { user: newUser, accessToken, refreshToken };
};

const loginUser = async (payload: ILoginUserPayload) => {
  const email = payload.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password.");
  }

  if (user.status === "BLOCKED") {
    throw new AppError(httpStatus.FORBIDDEN, "Your account has been blocked.");
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "Account no longer exists.");
  }

  if (!user.password && user.googleId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This account was created with Google. Please log in using Google.",
    );
  }

  const isPasswordValid = await bcrypt.compare(payload.password, user.password as string);
  if (!isPasswordValid) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password.");
  }

  const jwtPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );
  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  const { password: _, ...userData } = user;
  return { user: userData, accessToken, refreshToken };
};

const refreshToken = async (token: string) => {
  const verified = jwtUtils.verifyToken(token, config.jwt_refresh_secret);
  if (!verified.success || !verified.data) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid or expired refresh token");
  }

  const { userId } = verified.data;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || user.status !== "ACTIVE" || user.isDeleted) {
    throw new AppError(httpStatus.UNAUTHORIZED, "User inactive or not found");
  }

  const jwtPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );
  const newRefreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return { accessToken, refreshToken: newRefreshToken };
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
  const ticket = await googleClient.verifyIdToken({
    idToken: payload.idToken,
    audience: config.google_client_id,
  });
  const googlePayload = ticket.getPayload();

  if (!googlePayload || !googlePayload.email || !googlePayload.name) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid Google token payload");
  }

  const email = googlePayload.email.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: googlePayload.sub },
      });
    }
  } else {
    user = await prisma.user.create({
      data: {
        name: googlePayload.name,
        email,
        googleId: googlePayload.sub,
        authProvider: "GOOGLE" as any,
        emailVerified: true,
        imageUrl: googlePayload.picture || "",
      },
    });
  }

  const jwtPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );
  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  const { password: _, ...userData } = user;
  return { user: userData, accessToken, refreshToken };
};

const forgotPassword = async (payload: IForgotPasswordPayload) => {
  const email = payload.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.isDeleted || user.status === "BLOCKED") {
    throw new AppError(httpStatus.NOT_FOUND, "No active user found with this email.");
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const otpKey = `forgot-password-otp:${email}`;
  await redisClient.set(otpKey, otp, { EX: OTP_EXPIRY_SECONDS });

  const templatePath = path.join(process.cwd(), "src/app/templates/forgot-password.ejs");
  const html = await ejs.renderFile(templatePath, {
    otp,
    USER_NAME: user.name,
    APP_NAME: "My App",
    EXPIRY_MINUTES: OTP_EXPIRY_SECONDS / 60,
    CURRENT_YEAR: new Date().getFullYear(),
  });

  await transporter.sendMail({
    from: config.email_sender,
    to: email,
    subject: "Reset Your Password - OTP Code",
    html,
  });
};

const resetPassword = async (payload: IResetPasswordPayload) => {
  const email = payload.email.trim().toLowerCase();
  const otpKey = `forgot-password-otp:${email}`;
  const storedOtp = await redisClient.get(otpKey);

  if (!storedOtp || storedOtp !== payload.otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired OTP code.");
  }

  const hashedPassword = await bcrypt.hash(payload.newPassword, config.bcrypt_salt_rounds);

  await prisma.user.update({
    where: { email },
    data: { password: hashedPassword },
  });

  await redisClient.del(otpKey);
};

const getMe = async (requestUser: IRequestUser) => {
  const user = await prisma.user.findUnique({
    where: { id: requestUser.userId },
    omit: { password: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User profile not found.");
  }
  return user;
};

export const AuthService = {
  registerUser,
  verifyEmail,
  loginUser,
  refreshToken,
  googleLogin,
  forgotPassword,
  resetPassword,
  getMe,
};
```

### 9.4. `auth.controller.ts`
```ts
import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "./auth.interface";
import { AuthService } from "./auth.service";

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

const registerUser = catchAsync(async (req: Request, res: Response) => {
  await AuthService.registerUser(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Verification OTP code sent to your email.",
    data: null,
  });
});

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.verifyEmail(req.body);
  setAuthCookies(res, result.accessToken, result.refreshToken);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Email verified successfully.",
    data: result,
  });
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.loginUser(req.body);
  setAuthCookies(res, result.accessToken, result.refreshToken);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User logged in successfully.",
    data: result,
  });
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  const result = await AuthService.refreshToken(token);
  setAuthCookies(res, result.accessToken, result.refreshToken);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Access token refreshed successfully.",
    data: result,
  });
});

const googleLogin = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.googleLogin(req.body);
  setAuthCookies(res, result.accessToken, result.refreshToken);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Google sign-in successful.",
    data: result,
  });
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  await AuthService.forgotPassword(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password reset OTP sent to your email.",
    data: null,
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  await AuthService.resetPassword(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password reset successfully. You can now log in.",
    data: null,
  });
});

const getMe = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.getMe(req.user as unknown as IRequestUser);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User profile fetched successfully.",
    data: result,
  });
});

export const AuthController = {
  registerUser,
  verifyEmail,
  loginUser,
  refreshToken,
  googleLogin,
  forgotPassword,
  resetPassword,
  getMe,
};
```

### 9.5. `auth.route.ts`
```ts
import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";

const router = Router();

router.post(
  "/register",
  validateRequest(AuthValidation.RegisterZodSchema),
  AuthController.registerUser,
);

router.post(
  "/verify-email",
  validateRequest(AuthValidation.VerifyEmailZodSchema),
  AuthController.verifyEmail,
);

router.post(
  "/login",
  validateRequest(AuthValidation.LoginZodSchema),
  AuthController.loginUser,
);

router.post("/refresh-token", AuthController.refreshToken);
router.post("/google", AuthController.googleLogin);

router.post(
  "/forgot-password",
  validateRequest(AuthValidation.ForgotPasswordZodSchema),
  AuthController.forgotPassword,
);

router.post(
  "/reset-password",
  validateRequest(AuthValidation.ResetPasswordZodSchema),
  AuthController.resetPassword,
);

router.get("/me", auth(), AuthController.getMe);

export const AuthRoutes = router;
```

---

## 10. Database Seeder Utility (`src/app/utils/seed.ts`)

Ensures required administrative accounts exist on server startup without throwing duplicate key errors:

```ts
import bcrypt from "bcryptjs";
import config from "../config";
import { prisma } from "../lib/prisma";

export const seedSuperAdmin = async () => {
  try {
    const existing = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN" as any },
    });

    if (existing) {
      return;
    }

    const hashedPassword = await bcrypt.hash(
      config.super_admin_password,
      config.bcrypt_salt_rounds,
    );

    await prisma.user.create({
      data: {
        name: config.super_admin_name,
        email: config.super_admin_email,
        password: hashedPassword,
        role: "SUPER_ADMIN" as any,
        emailVerified: true,
      },
    });

    console.log("Super Admin seeded successfully!");
  } catch (error) {
    console.error("Error seeding Super Admin:", error);
  }
};
```

---

## 11. Application Entry Points (`app.ts` & `server.ts`)

### 11.1. `src/app.ts`
```ts
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application } from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";

const app: Application = express();

app.use(
  cors({
    origin: config.frontend_url,
    credentials: true,
  }),
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Health Check
app.get("/", (_req, res) => {
  res.status(httpStatus.OK).json({
    success: true,
    message: "Server is healthy and running.",
  });
});

// Application Routes
app.use("/api/v1/auth", AuthRoutes);

// Error Handling Middlewares
app.use(globalErrorHandler);
app.use(notFound);

export default app;
```

### 11.2. `src/server.ts`
```ts
import app from "./app";
import config from "./app/config";
import { transporter } from "./app/lib/nodemailer";
import { prisma } from "./app/lib/prisma";
import { redisClient } from "./app/lib/redis";
import { seedSuperAdmin } from "./app/utils/seed";

const PORT = config.port;

const main = async () => {
  try {
    await prisma.$connect();
    console.log("Connected to Database successfully.");

    await redisClient.connect();
    console.log("Connected to Redis successfully.");

    await transporter.verify();
    console.log("Nodemailer SMTP verified successfully.");

    await seedSuperAdmin();

    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

main();
```

---

## 12. Scaffold a New Feature Module (Step-by-Step Blueprint)

When asked to create a new domain module (e.g. `Product`, `Order`, `Post`), create the folder `src/app/module/<name>/` with these 5 standardized files:

### Step 1: `<name>.interface.ts`
```ts
export interface ICreateProductPayload {
  title: string;
  description: string;
  price: number;
}

export interface IProductFilterRequest {
  searchTerm?: string;
  category?: string;
}
```

### Step 2: `<name>.validation.ts`
```ts
import { z } from "zod";

const createProductZodSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  price: z.number().positive("Price must be a positive number"),
});

const updateProductZodSchema = createProductZodSchema.partial();

export const ProductValidation = {
  createProductZodSchema,
  updateProductZodSchema,
};
```

### Step 3: `<name>.service.ts`
```ts
import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { ICreateProductPayload } from "./product.interface";

const createProduct = async (payload: ICreateProductPayload) => {
  return await prisma.product.create({
    data: payload,
  });
};

const getAllProducts = async () => {
  return await prisma.product.findMany({
    where: { isDeleted: false },
  });
};

const getProductById = async (id: string) => {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product || product.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found");
  }
  return product;
};

export const ProductService = {
  createProduct,
  getAllProducts,
  getProductById,
};
```

### Step 4: `<name>.controller.ts`
```ts
import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ProductService } from "./product.service";

const createProduct = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.createProduct(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Product created successfully",
    data: result,
  });
});

const getAllProducts = catchAsync(async (_req: Request, res: Response) => {
  const result = await ProductService.getAllProducts();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Products fetched successfully",
    data: result,
  });
});

export const ProductController = {
  createProduct,
  getAllProducts,
};
```

### Step 5: `<name>.route.ts`
```ts
import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ProductController } from "./product.controller";
import { ProductValidation } from "./product.validation";

const router = Router();

router.post(
  "/",
  auth("ADMIN", "SUPER_ADMIN"),
  validateRequest(ProductValidation.createProductZodSchema),
  ProductController.createProduct,
);

router.get("/", ProductController.getAllProducts);

export const ProductRoutes = router;
```

---

## 13. Additional Common Domain Patterns

### 13.1. File & Image Upload (Multer Memory + Cloudinary Stream)

When uploading files, avoid storing files locally on the disk (which breaks in containerized / serverless / multi-instance deployments). Store files in memory buffer via `multer.memoryStorage()`, stream directly to Cloudinary, and delete old images when replacing:

#### `user.route.ts`
```ts
import { Router } from "express";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { UserController } from "./user.controller";

const router = Router();

router.patch(
  "/profile-image",
  auth(),
  upload.single("profileImage"),
  UserController.uploadProfileImage,
);

export const UserRoutes = router;
```

#### `user.controller.ts`
```ts
import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { UserService } from "./user.service";

const uploadProfileImage = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError(httpStatus.BAD_REQUEST, "No file uploaded.");
  }

  const userId = req.user!.userId;
  const result = await UserService.uploadProfileImage(req.file.buffer, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile image updated successfully.",
    data: result,
  });
});

export const UserController = {
  uploadProfileImage,
};
```

#### `user.service.ts`
```ts
import httpStatus from "http-status";
import { deleteFromCloudinary, uploadToCloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { imagePublicId: true, imageUrl: true },
  });

  if (!currentUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found.");
  }

  // 1. Upload new image buffer to Cloudinary
  const uploadResult = await uploadToCloudinary(buffer, "profile_images");

  // 2. Update user record with secure_url and public_id
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      imageUrl: uploadResult.secure_url,
      imagePublicId: uploadResult.public_id,
    },
    omit: { password: true },
  });

  // 3. Destroy old image from Cloudinary if existed
  if (currentUser.imagePublicId) {
    await deleteFromCloudinary(currentUser.imagePublicId);
  }

  return updatedUser;
};

export const UserService = {
  uploadProfileImage,
};
```

---

### 13.2. Payment Gateway Token Caching Pattern (Redis)

For external APIs requiring tokenized access (e.g. bKash, SSLCommerz, Shurjopay), cache grant tokens and refresh tokens in Redis with dynamic TTL:

```ts
import config from "../config";
import { redisClient } from "./redis";

export const getPaymentAccessToken = async () => {
  const TOKEN_KEY = "payment:access_token";
  const REFRESH_KEY = "payment:refresh_token";

  let token = await redisClient.get(TOKEN_KEY);
  const ttl = await redisClient.ttl(TOKEN_KEY);

  // If token is about to expire in < 10 mins and refresh token exists, refresh it
  if (ttl <= 600) {
    const refreshToken = await redisClient.get(REFRESH_KEY);
    if (refreshToken) {
      const response = await fetch(`${config.bkash_base_url}/tokenized/checkout/token/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const data = await response.json();
      token = data.id_token;
      await redisClient.set(TOKEN_KEY, token, { EX: 3600 });
      return token;
    }
  }

  if (token) return token;

  // Otherwise, grant a new token
  const response = await fetch(`${config.bkash_base_url}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_key: config.bkash_api_key,
      app_secret: config.bkash_app_secret,
    }),
  });

  const data = await response.json();
  await redisClient.set(TOKEN_KEY, data.id_token, { EX: 3600 });
  await redisClient.set(REFRESH_KEY, data.refresh_token, { EX: 3600 * 24 * 28 });
  return data.id_token;
};
```

---

### 13.3. Responsive EJS Email Templates (`src/app/templates/`)

#### Template 1: `registrationOTP.ejs`
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Verify Your Email</title>
</head>
<body style="margin:0; padding:0; background:#f4f7f6; font-family:Arial, Helvetica, sans-serif; color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f7f6; padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding:32px 40px; text-align:center; background:#111827;">
              <div style="font-size:26px; font-weight:700; color:#ffffff;"><%= APP_NAME %></div>
              <div style="margin-top:8px; font-size:13px; color:#9ca3af;">Verify your email address</div>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px; font-size:24px; color:#111827;">Hello <%= USER_NAME %>,</h1>
              <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#4b5563;">
                Thank you for signing up for <%= APP_NAME %>. Use the following One-Time Password (OTP) to verify your email. This code will expire in <%= EXPIRY_MINUTES %> minutes.
              </p>
              <div style="text-align:center; margin:32px 0;">
                <span style="display:inline-block; font-size:32px; font-weight:800; letter-spacing:8px; padding:16px 32px; background:#f3f4f6; border-radius:12px; color:#111827;">
                  <%= otpValue %>
                </span>
              </div>
              <p style="font-size:13px; color:#9ca3af; margin:0;">
                If you did not initiate this request, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px; text-align:center; background:#f9fafb; font-size:12px; color:#9ca3af;">
              © <%= CURRENT_YEAR %> <%= APP_NAME %>. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 14. Essential Tooling & Project Files

### 14.1. `package.json`
```json
{
  "name": "backend-starter",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "tsx src/server.ts",
    "format:check": "npx @biomejs/biome format ./src",
    "format:fix": "npx @biomejs/biome format --write ./src",
    "lint:check": "npx @biomejs/biome lint ./src",
    "lint:fix": "npx @biomejs/biome lint --write ./src"
  },
  "dependencies": {
    "@prisma/adapter-pg": "^7.9.1",
    "@prisma/client": "^7.9.1",
    "bcryptjs": "^3.0.3",
    "cloudinary": "^2.10.1",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "ejs": "^6.0.1",
    "express": "^5.2.1",
    "google-auth-library": "^11.0.0",
    "http-status": "^2.1.0",
    "jsonwebtoken": "^9.0.3",
    "multer": "^2.2.0",
    "nodemailer": "^9.0.5",
    "pg": "^8.22.0",
    "redis": "^6.2.1",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@biomejs/biome": "2.5.7",
    "@types/cookie-parser": "^1.4.10",
    "@types/cors": "^2.8.19",
    "@types/ejs": "^3.1.5",
    "@types/express": "^5.0.6",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/multer": "^2.2.0",
    "@types/node": "^26.1.2",
    "@types/nodemailer": "^8.0.1",
    "@types/pg": "^8.20.0",
    "prisma": "^7.9.1",
    "tsx": "^4.23.1",
    "typescript": "^7.0.2"
  }
}
```

### 14.2. `tsconfig.json`
```json
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "target": "es2023",
    "rootDir": "./",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "ignoreDeprecations": "5.0"
  },
  "include": ["src", "prisma.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### 14.3. `biome.json`
```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.7/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": false,
    "includes": ["**", "!src/app/templates"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "preset": "recommended",
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "correctness": {
        "noUnusedFunctionParameters": "off"
      }
    },
    "includes": ["!src/app/templates"]
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double"
    }
  },
  "assist": {
    "enabled": true,
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  }
}
```

---

## 15. Step-by-Step Project Initialization Commands

When starting a project with this blueprint:

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Fill in DATABASE_URL, Redis, JWT secrets, and Nodemailer credentials

# 3. Generate Prisma client
npx prisma generate

# 4. Run database migrations
npx prisma migrate dev --name init

# 5. Start dev server with hot reload
npm run dev
```
