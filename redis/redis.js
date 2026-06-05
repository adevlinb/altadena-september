import { awsGet } from "../amazon/amazon.js";
import { localGet } from "../map/utility.js";
import zlib from "node:zlib";
import { promisify } from "node:util";

const gzip = promisify(zlib.gzip);

export async function getMapFile(req, res) {
    try {
        const { filename } = req.query;
        const file = await fetchCompressedFile(filename);
    
        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        console.log(`${filename} size: ${(file.length / 1024 / 1024).toFixed(2)} MB`);
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Length", file.length);
        res.end(file);
    } catch (err) {
        console.warn("Error fetching map file:", err);
        res.status(500).json({ error: "Server error fetching file" });
    }
}

async function fetchCompressedFile(fileName) {
	const awsFile = await awsGet(fileName, false).catch(() => null);
	if (awsFile) {
    // awsGet returns an already-gzipped buffer as a numeric-keyed object
		const buffer = Buffer.isBuffer(awsFile) 
			? awsFile 
			: Buffer.from(Object.values(awsFile));
		return buffer; // already gzipped, send as-is
	}

    const localFile = await localGet(fileName).catch(() => null);
    if (localFile) {
        return await gzip(JSON.stringify(localFile));
    }

    return null;
}

export async function getRedisClient() { return null; }
export async function updateRedisCache() {}
export async function shutdownRedis() {}