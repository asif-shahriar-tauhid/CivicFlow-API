import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import { AppError } from "../../utils/AppError";
import { jwtUtils } from "../../utils/jwt";
import type {
  ILoginUserPayload,
  IRegisterUserPayload,
  IRequestUser,
  IVerifyEmailPayload,
} from "./auth.interface";
import path from "path";
import ejs from "ejs";
import { transporter } from "../../lib/nodemailer";

const OTP_EXPIRY_SECONDS = 5 * 60;

const createTokens = (user: {
  id: string;
  email: string;
  name: string;
  role: string;
}) => {
  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
  return {
    accessToken: jwtUtils.createToken(
      payload,
      config.jwt_access_secret,
      config.jwt_access_expires_in,
    ),
    refreshToken: jwtUtils.createToken(
      payload,
      config.jwt_refresh_secret,
      config.jwt_refresh_expires_in,
    ),
  };
};

const registerUser = async ({
  name,
  email,
  password,
  user: userData,
}: IRegisterUserPayload) => {
  const normalizedEmail = email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email: normalizedEmail } })) {
    throw new AppError(
      httpStatus.CONFLICT,
      "User with this email already exists.",
    );
  }

  const hashedPassword = await bcrypt.hash(password, config.bcrypt_salt_rounds);

  const otpKey = `registration:${normalizedEmail}`;
  const otpValue = crypto.randomInt(100000, 1000000).toString();
  await redisClient.set(otpKey, otpValue, {
    expiration: {
      type: "EX",
      value: OTP_EXPIRY_SECONDS,
    },
  });

  const userRegistrationKey = `user-registration-data:${normalizedEmail}`;
  const redisUserDataPayload = {
    name,
    email,
    password: hashedPassword,
    user: userData,
  };

  await redisClient.set(
    userRegistrationKey,
    JSON.stringify(redisUserDataPayload),
    {
      expiration: {
        type: "EX",
        value: OTP_EXPIRY_SECONDS,
      },
    },
  );

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/registrationOTP.ejs",
  );

  const emailHTML = await ejs.renderFile(templatePath, {
    otpValue,
    APP_NAME: "CivicFlow",
    USER_NAME: name,
    EXPIRY_MINUTES: OTP_EXPIRY_SECONDS / 60,
    CURRENT_YEAR: new Date().getFullYear(),
  });

  await transporter.sendMail({
    from: config.email_sender,
    to: email,
    subject: "Email Verification OTP.",
    html: emailHTML,
  });
};

const verifyEmail = async ({ email, otp }: IVerifyEmailPayload) => {
  const normalizedEmail = email.trim().toLowerCase();

  const isUserExist = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (isUserExist?.emailVerified) {
    throw new AppError(httpStatus.CONFLICT, "Email already verified.");
  }

  if (isUserExist?.status === "BLOCKED") {
    throw new AppError(httpStatus.FORBIDDEN, "User is Blocked.");
  }

  if (isUserExist?.isDeleted || isUserExist?.status === "DELETED") {
    throw new AppError(httpStatus.BAD_REQUEST, "User is Deleted.");
  }

  const otpKey = `user-registration-otp: ${normalizedEmail}`;
  const redisOTP = await redisClient.get(otpKey)
  const value = await redisClient.get(`registration:${normalizedEmail}`);
  if (!value)
    throw new AppError(httpStatus.BAD_REQUEST, "Registration session expired.");
  const pending = JSON.parse(value) as {
    name: string;
    email: string;
    password: string;
    otp: string;
  };
  if (pending.otp !== otp)
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid verification OTP.");

  const user = await prisma.user.create({
    data: {
      name: pending.name,
      email: pending.email,
      password: pending.password,
      emailVerified: true,
    },
    omit: { password: true },
  });
  await redisClient.del(`registration:${normalizedEmail}`);
  return { user, ...createTokens(user) };
};

const loginUser = async ({ email, password }: ILoginUserPayload) => {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user?.password || !(await bcrypt.compare(password, user.password))) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password.");
  }
  if (user.status !== "ACTIVE" || user.isDeleted)
    throw new AppError(httpStatus.FORBIDDEN, "Account is not active.");
  const { password: _password, ...userData } = user;
  return { user: userData, ...createTokens(user) };
};

const getMe = async (requestUser: IRequestUser) => {
  const user = await prisma.user.findUnique({
    where: { id: requestUser.userId },
    omit: { password: true },
  });
  if (!user)
    throw new AppError(httpStatus.NOT_FOUND, "User profile not found.");
  return user;
};

export const AuthService = { registerUser, verifyEmail, loginUser, getMe };
