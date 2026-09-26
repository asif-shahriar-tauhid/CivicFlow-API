import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const config = {
  node_env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  database_url: process.env.DATABASE_URL || "",
  frontend_url: process.env.FRONTEND_URL || "http://localhost:3000",
  backend_url: process.env.BACKEND_URL || "http://localhost:5000",
  bcrypt_salt_rounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
  jwt_access_secret:
    process.env.JWT_ACCESS_SECRET || "development-access-secret",
  jwt_refresh_secret:
    process.env.JWT_REFRESH_SECRET || "development-refresh-secret",
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN || "1d",
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  redis_url: process.env.REDIS_URL || "",
  google_client_id: process.env.GOOGLE_CLIENT_ID || "",
  super_admin_name: process.env.SUPER_ADMIN_NAME || "Super Admin",
  super_admin_email: process.env.SUPER_ADMIN_EMAIL || "superadmin@example.com",
  super_admin_password: process.env.SUPER_ADMIN_PASSWORD || "Password@123",
  redis_user: process.env.REDIS_USER,
  redis_password: process.env.REDIS_PASSWORD,
  redis_host: process.env.REDIS_HOST || "localhost",
  redis_port: Number(process.env.REDIS_PORT) || 6379,
  smtp_user: process.env.SMTP_USER,
  smtp_password: process.env.SMTP_PASSWORD,
  email_sender: process.env.EMAIL_SENDER,
  cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET,
  bkash_base_url: process.env.BKASH_BASE_URL,
  bkash_username: process.env.BKASH_USERNAME,
  bkash_password: process.env.BKASH_PASSWORD,
  bkash_app_key: process.env.BKASH_APP_KEY,
  bkash_app_secret: process.env.BKASH_APP_SECRET,
  bkash_callback_url: process.env.BKASH_CALLBACK_URL,
  bkash_success_url:
    process.env.BKASH_SUCCESS_URL ||
    "http://localhost:5000/api/v1/request-payments/bkash/callback/success",
  bkash_cancel_url:
    process.env.BKASH_CANCEL_URL ||
    "http://localhost:5000/api/v1/request-payments/bkash/callback/cancel",
  bkash_failure_url:
    process.env.BKASH_FAILURE_URL ||
    "http://localhost:5000/api/v1/request-payments/bkash/callback/failure",
};

export default config;
