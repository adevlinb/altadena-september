// IMPORTS
import express from "express";
import * as path from "path";
import logger from "morgan";
import cors from "cors";
import 'dotenv/config'
import { checkApiKey } from "./config/checkKey.js";
import updateMap from "./map/update.js";
import { createClient } from "redis";
import { awsGet } from "./amazon/amazon.js";
import { localGet } from "./map/utility.js";
import zlib from "node:zlib";
import { promisify } from "node:util";

// CONFIG
const app = express();
app.use(cors())
app.use(logger('dev'));
app.use(express.json());
const __dirname = path.resolve();
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// REDIS CONFIG
let redisClient;
let redisConnected = false;
let redisConnecting = null;
async function getRedisClient() {
    if (redisConnected)  return redisClient;
    if (redisConnecting) return redisConnecting; // wait for ongoing connection attempt

    redisConnecting = (async () => {
        try {
            redisClient = createClient({ url: "redis://127.0.0.1:6379" });
            redisClient.on("error", (err) => console.error("Redis error:", err));
            await redisClient.connect();
            redisConnected = true;
            console.log("Redis connected");
            return redisClient;
        } catch (err) {
            console.warn("Redis unavailable, proceeding without cache:", err);
            redisClient = null;
            redisConnected = false;
            return null;
        } finally {
            redisConnecting = null; // reset promise after attempt
        }
    })();

    return redisConnecting;
}

async function updateRedisCache(baseSrc, masterSrc) {
	if (!redisClient && !redisConnected && !redisConnecting) await getRedisClient();
	if (!redisClient) {
		console.warn("Redis unavailable, skipping cache update");
		return;
	}

	try {
		const compressedBase   = await gzip(JSON.stringify(baseSrc));
		const compressedMaster = await gzip(JSON.stringify(masterSrc));

		await Promise.all([
			redisClient.set("base-source.json",   compressedBase.toString("base64")),
			redisClient.set("master-source.json", compressedMaster.toString("base64")),
		]);

		console.log("Redis cache updated after map update");

	} catch (err) {
		console.warn("Failed to update Redis cache:", err);
	}
}

// ROUTES
app.get("/map", async (req, res) => {
	try {
		await getRedisClient();

		const getFile = async (fileName) => {
			try {
				if (redisClient) {
					const cached = await redisClient.get(fileName);
					if (cached) {
						const buffer = Buffer.from(cached, "base64");
						const decompressed = await gunzip(buffer);
						return JSON.parse(decompressed.toString("utf-8"));
					} else {
						throw new Error("Cache not found")
					}
				}

			} catch (err) {
				console.log(`Cache miss or Redis unavailable, fetching from S3: ${fileName}, err: ${err}`);

				try {
					throw new Error("do not want to test aws right now")
					const fresh = await awsGet(fileName);
		
					if (redisClient) {
						const compressed = await gzip(JSON.stringify(fresh));
						await redisClient.set(fileName, compressed.toString("base64"));
					}
		
					return fresh;
				} catch (err) {
					console.warn("AWS Get Failure - Attempting Local Files", err);
					const fresh = await localGet(fileName);
					if (redisClient) {
						const compressed = await gzip(JSON.stringify(fresh));
						await redisClient.set(fileName, compressed.toString("base64"));
					}
					return fresh
				}
			}
		};

		const [baseSource, masterSource] = await Promise.all([
			getFile("base-source.json"),
			getFile("master-source.json"),
		]);

		res.json({ baseSource, masterSource });
	} catch (err) {
		console.error("Failed to serve /map:", err);
		res.status(500).json({ error: "Failed to load map data" });
	}
});

app.put("/buildNote", checkApiKey, async (req, res, next) => {
    try {
        const { baseSrc, masterSrc } = await updateMap(req, res);
        await updateRedisCache(baseSrc, masterSrc);
    } catch (err) {
        console.error("Error in /buildNote:", err);
    }
});

// CATCH ALL ROUTE => `index.html`
app.use(express.static(path.join(__dirname, 'dist')));
app.use(/.*/, function (req, res) {
	res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// SERVER LISTENING
const port = process.env.PORT || 3001;
const server = app.listen(port, function () {
	console.log(`Express app running on port ${port}`)
});

// CLEANUP
async function shutdown() {
    console.log("Shutting down...");
    if (redisClient && redisConnected) await redisClient.disconnect();

    server.close(() => {
        console.log("HTTP server closed");
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);