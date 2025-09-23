
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
                    tls: true,
                    rejectUnauthorized: false  // Heroku’s self-signed certs require this
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

export async function getMapFiles(req, res) {
    const fetchFile = async (fileName) => {
        // Try Redis first
        const client = await getRedisClient().catch(() => null);
        if (client) {
            try {
                const cached = await client.get(fileName);
                if (cached) {
                    const buffer = Buffer.from(cached, "base64");
                    const decompressed = await gunzip(buffer);
                    console.log(`Redis cache for ${fileName} found successfully.`)
                    return JSON.parse(decompressed.toString("utf-8"));
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
        if (awsFile) return awsFile;

        // Fallback to local
        const localFile = await localGet(fileName).catch(err => {
            console.log(`Local fetch failed for ${fileName}:`, err);
            return null;
        });
        return localFile
    };

    try {
        // Fetch both files in parallel
        const [baseSource, masterSource] = await Promise.all([
            fetchFile("base-source.json"),
            fetchFile("master-source.json")
        ]);

        // Update Redis cache asynchronously, but don’t block response
        updateRedisCache(baseSource, masterSource).catch(err => {
            console.warn("Redis cache update failed:", err);
        });

        res.json({ baseSource: baseSource || null, masterSource: masterSource || null });
    } catch (err) {
        console.error("Failed to serve /map:", err);
        res.status(500).json({ baseSource: null, masterSource: null });
    }
}

export async function updateRedisCache(baseSrc, masterSrc) {
    const client = await getRedisClient();
    if (!client || !baseSrc || !masterSrc) return;

    try {
        const compressedBase = await gzip(JSON.stringify(baseSrc));
        const compressedMaster = await gzip(JSON.stringify(masterSrc));

        await Promise.all([
            client.set("base-source.json", compressedBase.toString("base64")),
            client.set("master-source.json", compressedMaster.toString("base64")),
        ]);

        console.log("Redis cache updated successfully");
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