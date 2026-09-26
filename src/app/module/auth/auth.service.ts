import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import config from "../../config";
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
import path from "path";
import ejs from "ejs";
import { transporter } from "../../lib/nodemailer";
import type { TokenPayload } from "google-auth-library";
import {
  AuthProvider,
  Role,
  UserStatus,
} from "../../../generated/prisma/enums";
import { googleClient } from "../../lib/googleAuth";

const OTP_EXPIRY_SECONDS = 5 * 60;

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
    email: normalizedEmail,
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

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingUser?.emailVerified) {
    throw new AppError(httpStatus.CONFLICT, "Email already verified.");
  }

  const otpKey = `registration:${normalizedEmail}`;
  const redisOTP = await redisClient.get(otpKey);
  if (!redisOTP || redisOTP !== otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired OTP.");
  }

  const userRegistrationKey = `user-registration-data:${normalizedEmail}`;
  const redisUserData = await redisClient.get(userRegistrationKey);
  if (!redisUserData) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Registration session expired. Please register again.",
    );
  }

  const userPayload = JSON.parse(redisUserData) as IRegisterUserPayload;
  const createdUser = await prisma.user.create({
    data: {
      name: userPayload.name,
      email: userPayload.email,
      password: userPayload.password,
      role: Role.CITIZEN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      citizen: {
        create: {
          name: userPayload.name,
          email: userPayload.email,
          contactNumber: userPayload.user?.contactNumber,
        },
      },
    },
    include: {
      citizen: true,
    },
  });

  await redisClient.del(userRegistrationKey);

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/patient-welcome-email.ejs",
  );

  const emailHTML = await ejs.renderFile(templatePath, {
    APP_NAME: "CivicFlow",
    USER_NAME: createdUser.name,
    LOGIN_URL: config.frontend_url,
    CURRENT_YEAR: new Date().getFullYear(),
  });

  await transporter.sendMail({
    from: config.email_sender,
    to: email,
    subject: "Welcome to CivicFlow.",
    html: emailHTML,
  });

  const { password: _password, citizen, ...user } = createdUser;
  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in,
  );

  return {
    user,
    citizen,
    accessToken,
    refreshToken,
  };
};

const loginUser = async ({ email, password }: ILoginUserPayload) => {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.status === UserStatus.BLOCKED) {
    throw new Error("User is blocked");
  }

  if (user.isDeleted || user.status === UserStatus.DELETED) {
    throw new Error("User is deleted");
  }

  if (user.password === null && user.googleId !== null) {
    throw new Error(
      "User Already has a Google Registered Account. Try Login with Google",
    );
  }

  const isPasswordMatched = await bcrypt.compare(
    password,
    user.password as string,
  );

  if (!isPasswordMatched) {
    throw new Error("Invalid credentials");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in,
  );

  return {
    accessToken,
    refreshToken,
  };
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

const refreshToken = async (token: string) => {
  const verifiedRefreshToken = jwtUtils.verifyToken(
    token,
    config.jwt_refresh_secret,
  );

  if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
    throw new Error(
      config.node_env === "development"
        ? verifiedRefreshToken.error
        : "Invalid refresh token",
    );
  }

  const data = verifiedRefreshToken.data;

  const user = await prisma.user.findUnique({
    where: { id: data.userId },
  });

  if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
    throw new Error("User is inactive or not found");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in,
  );

  return {
    accessToken,
    refreshToken,
  };
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
  let googleIdTokenPayload: TokenPayload | null | undefined = null;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: payload.idToken,
      audience: config.google_client_id,
    });

    googleIdTokenPayload = ticket.getPayload();
  } catch (error) {
    console.log("Google ID Token Verification Failed.", error);
    throw new Error("Invalid Or Expired Google Id Token.");
  }

  if (!googleIdTokenPayload) {
    throw new Error("Invalid Or Expired Google Id Token.");
  }

  if (!googleIdTokenPayload.email) {
    throw new Error("Google Email not found.");
  }
  if (!googleIdTokenPayload.name) {
    throw new Error("Name not found.");
  }

  const ifPatientExistsWithGoogleAuth = await prisma.user.findUnique({
    where: {
      email: googleIdTokenPayload.email,
      role: Role.CITIZEN,
      googleId: googleIdTokenPayload.sub,
    },
  });

  let user = ifPatientExistsWithGoogleAuth;

  if (!ifPatientExistsWithGoogleAuth) {
    const ifPatientExistsWithCredential = await prisma.user.findUnique({
      where: {
        email: googleIdTokenPayload.email,
        role: Role.CITIZEN,
        authProvider: AuthProvider.CREDENTIAL,
      },
    });

    if (ifPatientExistsWithCredential) {
      if (ifPatientExistsWithCredential) {
        if (!ifPatientExistsWithCredential.emailVerified) {
          throw new Error("Email Not Verified.");
        }
      }
      if (ifPatientExistsWithCredential.status === UserStatus.BLOCKED) {
        throw new Error(
          "Your account has been blocked. Please contact support.",
        );
      }

      if (
        ifPatientExistsWithCredential?.isDeleted ||
        ifPatientExistsWithCredential?.status === UserStatus.DELETED
      ) {
        throw new Error("User is deleted.");
      }

      user = await prisma.user.update({
        where: {
          id: ifPatientExistsWithCredential.id,
        },
        data: {
          googleId: googleIdTokenPayload.sub,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          name: googleIdTokenPayload.name,
          email: googleIdTokenPayload.email,
          role: Role.CITIZEN,
          googleId: googleIdTokenPayload.sub,
          authProvider: AuthProvider.GOOGLE,
          emailVerified: true,
          citizen: {
            create: {
              name: googleIdTokenPayload.name,
              email: googleIdTokenPayload.email,
            },
          },
        },
      });

      const templatePath = path.join(
        process.cwd(),
        "src/app/templates/patient-welcome-email.ejs",
      );

      const emailHTML = await ejs.renderFile(templatePath, {
        APP_NAME: "CivicFlow",
        USER_NAME: user.name,
        LOGIN_URL: config.frontend_url,
        CURRENT_YEAR: new Date().getFullYear(),
      });

      await transporter.sendMail({
        from: config.email_sender,
        to: user.email,
        subject: "Welcome to CivicFlow",
        html: emailHTML,
      });
    }
  }

  if (!user) {
    throw new Error("User not found.");
  }

  if (user.status === UserStatus.BLOCKED) {
    throw new Error("Your account has been blocked. Please contact support.");
  }

  if (user?.isDeleted || user?.status === UserStatus.DELETED) {
    throw new Error("User is deleted.");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in,
  );

  return {
    accessToken,
    refreshToken,
  };
};

const forgotPassword = async (payload: IForgotPasswordPayload) => {
  const { email } = payload;

  const doesUserExist = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!doesUserExist) {
    throw new Error("User Does Not exist!");
  }

  if (doesUserExist.status === "BLOCKED") {
    throw new Error("User is Blocked");
  }

  if (!doesUserExist.emailVerified) {
    throw new Error("User is not verified.");
  }

  if (doesUserExist.isDeleted || doesUserExist.status === "DELETED") {
    throw new Error("User is Deleted");
  }

  if (doesUserExist.googleId && doesUserExist.authProvider !== "GOOGLE") {
    throw new Error("User has an Account with Google");
  }

  const otp = crypto.randomInt(100000, 1000000).toString();

  const key = `Forgot-password-otp:${doesUserExist.email}`;

  const expirationSeconds = 5 * 60;

  await redisClient.set(key, otp, {
    expiration: {
      type: "EX",
      value: expirationSeconds,
    },
  });

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/forgot-password.ejs",
  );

  const emailHTML = await ejs.renderFile(templatePath, {
    otp,
    APP_NAME: "CivicFlow",
    USER_NAME: doesUserExist.name,
    EXPIRY_MINUTES: expirationSeconds / 60,
    CURRENT_YEAR: new Date().getFullYear(),
  });

  await transporter.sendMail({
    from: config.email_sender,
    to: doesUserExist.email,
    subject: "Forgot Password.",
    // text: `Your OTP is ${otp}`,
    html: emailHTML,
  });
};

const resetPassword = async (payload: IResetPasswordPayload) => {
  const { email, newPassword, otp } = payload;

  const doesUserExist = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!doesUserExist) {
    throw new Error("User Does Not exist!");
  }

  if (doesUserExist.status === "BLOCKED") {
    throw new Error("User is Blocked");
  }

  if (!doesUserExist.emailVerified) {
    throw new Error("User is not verified.");
  }

  if (doesUserExist.isDeleted || doesUserExist.status === "DELETED") {
    throw new Error("User is Deleted");
  }

  if (doesUserExist.googleId && doesUserExist.authProvider !== "GOOGLE") {
    throw new Error("User has an Account with Google");
  }

  const key = `Forgot-password-otp:${doesUserExist.email}`;
  const redisOTP = await redisClient.get(key);

  if (!redisOTP) throw new Error("Invalid OTP");
  if (redisOTP !== otp) {
    throw new Error("OTP does not match");
  }

  const hashedNewPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  await prisma.user.update({
    where: {
      email: doesUserExist.email,
    },
    data: {
      password: hashedNewPassword,
    },
  });

  await redisClient.del([key]);

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/reset-password-success.ejs",
  );

  const emailHTML = await ejs.renderFile(templatePath, {
    APP_NAME: "CivicFlow",
    USER_NAME: doesUserExist.name,
    CURRENT_YEAR: new Date().getFullYear(),
  });

  await transporter.sendMail({
    from: config.email_sender,
    to: doesUserExist.email,
    subject: "Password Changed.",
    // text: `Your OTP is ${otp}`,
    html: emailHTML,
  });
};

export const AuthService = {
  registerUser,
  verifyEmail,
  loginUser,
  getMe,
  refreshToken,
  googleLogin,
  forgotPassword,
  resetPassword,
};
