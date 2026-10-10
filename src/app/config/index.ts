import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const isProduction =
	process.env.NODE_ENV === "production" ||
	process.env.VERCEL === "1" ||
	Boolean(process.env.VERCEL_ENV) ||
	Boolean(process.env.BACKEND_URL?.startsWith("https"));

const resolveDefaultFrontendUrl = (): string => {
	const raw = process.env.FRONTEND_URL?.trim();
	if (raw) {
		const urls = raw
			.split(",")
			.map((u) => u.trim())
			.filter(Boolean);

		if (isProduction) {
			const prodUrl = urls.find(
				(u) => !u.includes("localhost") && !u.includes("127.0.0.1"),
			);
			if (prodUrl) return prodUrl;
		} else {
			const localUrl = urls.find(
				(u) => u.includes("localhost") || u.includes("127.0.0.1"),
			);
			if (localUrl) return localUrl;
			if (urls[0]) return urls[0];
		}
	}

	return isProduction
		? "https://civic-flow-frontend-psi.vercel.app"
		: "http://localhost:3000";
};

const config = {
	node_env: process.env.NODE_ENV || "development",
	port: Number(process.env.PORT) || 5000,
	database_url: process.env.DATABASE_URL || "",
	frontend_url: resolveDefaultFrontendUrl(),
	backend_url: process.env.BACKEND_URL || "https://civic-flow-api.vercel.app",
	bcrypt_salt_rounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
	jwt_access_secret:
		process.env.JWT_ACCESS_SECRET || "development-access-secret",
	jwt_refresh_secret:
		process.env.JWT_REFRESH_SECRET || "development-refresh-secret",
	jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN || "1d",
	jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
	request_reopen_window_days: Math.max(
		Number(process.env.REQUEST_REOPEN_WINDOW_DAYS) || 7,
		1,
	),
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
		`${process.env.BACKEND_URL || "https://civic-flow-api.vercel.app"}/api/v1/request-payments/bkash/callback/success`,
	bkash_cancel_url:
		process.env.BKASH_CANCEL_URL ||
		`${process.env.BACKEND_URL || "https://civic-flow-api.vercel.app"}/api/v1/request-payments/bkash/callback/cancel`,
	bkash_failure_url:
		process.env.BKASH_FAILURE_URL ||
		`${process.env.BACKEND_URL || "https://civic-flow-api.vercel.app"}/api/v1/request-payments/bkash/callback/failure`,
};

export default config;
