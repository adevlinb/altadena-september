
import { awsGet } from "../amazon/amazon.js";
import { localGet } from "../map/utility.js";
import zlib from "node:zlib";
import { promisify } from "node:util";
import { createClient } from "redis";
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

let redisClient = null;
let redisConnecting = null;

export async function getRedisClient() {
    if (redisClient?.isOpen) return redisClient;
    if (redisConnecting) return redisConnecting;

    redisConnecting = (async () => {
        try {
            const client = createClient({
                url: process.env.REDISCLOUD_URL,
                socket: {
                    tls: (process.env.REDISCLOUD_URL.match(/rediss:/) != null),
                    rejectUnauthorized: false,
                }
            });
            client.on("error", (err) => {
                console.error("Redis error:", err);
                redisClient = null;
            });

            await client.connect();
            redisClient = client;
            console.log("✅ Redis connected");
            return redisClient;
        } catch (err) {
            console.warn("⚠️ Redis unavailable, proceeding without cache:", err);
            redisClient = null;
            return null;
        } finally {
            redisConnecting = null;  // always reset
        }
    })();

    return redisConnecting;
}

export async function getMapFile(req, res) {
    try {
        const { filename } = req.query;
        const gzippedBuffer = await fetchCompressedFile(filename);
    
        if (!gzippedBuffer) {
            return res.status(404).json({ error: "File not found" });
        }

        console.log(`${filename} size: ${(gzippedBuffer.length / 1024 / 1024).toFixed(2)} MB`);
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Length", gzippedBuffer.length);
        res.end(gzippedBuffer);
    } catch (err) {
        console.warn("Error fetching cache from redis: ", err);
        res.status(500).json({ error: "Server error fetching file" });
    }
}



export async function updateRedisCache(filename, compressedFile) {
    const client = await getRedisClient();
    if (!client || !compressedFile) return;

    try {
        await client.set(filename, compressedFile.toString("base64"));
        console.log(`Redis cache updated successfully for ${filename}`);
    } catch (err) {
        console.warn("Failed to update Redis cache:", err);
    }
}

export async function shutdownRedis() {
    if (redisClient?.isOpen) {
        await redisClient.disconnect();
        redisClient = null;
        console.log("Redis disconnected");
    }
}

async function fetchCompressedFile(fileName) {
    const client = await getRedisClient().catch(() => null);
    
    if (client) {
        const cached = await client.get(fileName); // string
        if (cached) {
            const base64 = await client.get(fileName);
            const buffer = Buffer.from(base64, "base64");
            return buffer;
        }
    }

    // get AWS S3 NOT DECOMP
    const awsFile = await awsGet(fileName, false).catch(() => null);
    if (awsFile) {
        updateRedisCache(fileName, awsFile).catch(err => console.warn("Redis update failed:", err));
        return awsFile;
    }

    const localFile = await localGet(fileName).catch(() => null);
    if (localFile) {
        const compressed = await gzip(JSON.stringify(localFile));
        updateRedisCache(fileName, compressed).catch(err => console.warn("Redis update failed:", err));
        return compressed;
    }

    return null;
}