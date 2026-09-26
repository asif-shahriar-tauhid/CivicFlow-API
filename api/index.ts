import app from "../src/app";
import { prisma } from "../src/app/lib/prisma";
import { redisClient } from "../src/app/lib/redis";
import { seedSuperAdmin } from "../src/app/utils/seed";

// Vercel serverless: connect once per cold start, reuse across invocations
let isReady = false;

async function bootstrap() {
	if (isReady) return;
	await prisma.$connect();

	// Redis: attempt connection but don't block if unavailable
	try {
		if (!redisClient.isOpen) {
			await redisClient.connect();
		}
	} catch (error) {
		console.error("Redis connection failed (non-fatal):", error);
	}

	await seedSuperAdmin();
	isReady = true;
}

export default async function handler(req: any, res: any) {
	await bootstrap();
	app(req, res);
}
