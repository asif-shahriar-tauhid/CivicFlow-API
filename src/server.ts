import app from "./app";
import config from "./app/config";
import { prisma } from "./app/lib/prisma";
import { redisClient } from "./app/lib/redis";
import { seedSuperAdmin } from "./app/utils/seed";

const main = async () => {
	try {
		await prisma.$connect();
		await redisClient.connect();
		await seedSuperAdmin();
		app.listen(config.port, () =>
			console.log(`Server listening on port ${config.port}`),
		);
	} catch (error) {
		console.error("Failed to start server:", error);
		await prisma.$disconnect();
		process.exit(1);
	}
};

main();
