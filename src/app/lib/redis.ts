import { createClient } from "redis";
import config from "../config";

export const redisClient = createClient({
	url: config.redis_url,
});

redisClient.on("error", (error) => console.error("Redis Client Error", error));
