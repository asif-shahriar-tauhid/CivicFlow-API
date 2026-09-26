import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import { processBreaches } from "./sla.service";

const main = async () => {
  try {
    await prisma.$connect();
    if (!redisClient.isOpen) await redisClient.connect();
    const result = await processBreaches();
    console.log(JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
    if (redisClient.isOpen) await redisClient.quit();
  }
};

main().catch((error) => {
  console.error("SLA processing failed:", error);
  process.exitCode = 1;
});
