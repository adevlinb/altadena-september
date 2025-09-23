
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
    console.log(process.env.REDISCLOUD_URL, "checking redis url from env")

    redisConnecting = (async () => {
        try {
            const client = createClient({
                url: process.env.REDISCLOUD_URL,
                // socket: {
                //     tls: true,
                //     rejectUnauthorized: false  // Heroku’s self-signed certs require this
                // }
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

export async function getMapFiles(req, res) {
    const fetchFile = async (fileName) => {
        const client = await getRedisClient().catch(() => null);
        if (client) {
            try {
                const cached = await client.get(fileName);
                if (cached) {
                    const buffer = Buffer.from(cached, "base64");       // decode base64
                    const decompressed = await gunzip(buffer);          // decompress gzip
                    return JSON.parse(decompressed.toString("utf-8"));  // parse JSON
                }
            } catch (err) {
                console.log(`Cache miss/decompress error for ${fileName}:`, err);
            }
        }

        // Try AWS next
        const awsFile = await awsGet(fileName).catch(err => {
            console.log(`AWS fetch failed for ${fileName}:`, err);
            return null;
        });
        if (awsFile) {
            updateRedisCache(fileName, awsFile).catch(err => { console.warn("Redis cache update failed:", err) });
            return awsFile;
        }

        // Fallback to local
        const localFile = await localGet(fileName).catch(err => {
            console.log(`Local fetch failed for ${fileName}:`, err);
            return null;
        });
        updateRedisCache(fileName, localFile).catch(err => { console.warn("Redis cache update failed:", err) });
        return localFile;
    };

    try {
        // Fetch both files in parallel
        const [baseSource, masterSource] = await Promise.all([
            fetchFile("base-source.json"),
            fetchFile("master-source.json")
        ]);

        const payload = JSON.stringify({ baseSource: baseSource || null, masterSource: masterSource || null });
        res.setHeader("Content-Length", Buffer.byteLength(payload));
        res.setHeader("Content-Type", "application/json");
        res.send(payload);
    } catch (err) {
        console.error("Failed to serve /map:", err);
        res.status(500).json({ baseSource: null, masterSource: null });
    }
}

export async function updateRedisCache(filename, file) {
    const client = await getRedisClient();
    if (!client || !file) return;

    try {
        const compressed = await gzip(JSON.stringify(file));
        await client.set(filename, compressed.toString("base64")),
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