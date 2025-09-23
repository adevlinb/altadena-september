import { S3Client, GetObjectCommand, PutObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";

import zlib from "node:zlib";
import { promisify } from "node:util";
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);


export async function awsCopy(sourceKey, destKey) {
    const { S3_REGION, S3_BUCKET } = process.env;
    const s3Client = new S3Client({ region: S3_REGION });

    try {
        const copyParams = {
            Bucket: S3_BUCKET,
            CopySource: `${S3_BUCKET}/${sourceKey}`,
            Key: destKey,
        };

        await s3Client.send(new CopyObjectCommand(copyParams));
        console.log(`Copied ${sourceKey} → ${destKey}`);
    } catch (err) {
        console.error(`Error copying ${sourceKey} to ${destKey}:`, err);
        throw err;
    }
}

// REGULAR AWS
// export async function awsGet(fileName) {
//     try {
//         const s3params = {
//             Bucket: S3_BUCKET,
//             Key: fileName,
//         }
//         const command = new GetObjectCommand(s3params);
//         const response = await s3Client.send(command);
//         const body = await response.Body.transformToString();
//         return JSON.parse(body);
//     } catch (err) {
//         console.error(`Error fetching ${fileName} from S3:`, err);
//         throw err;
//     }
// }

// DECOMPRESS AWS
// export async function awsGet(fileName) {
//     try {
//         const s3params = {
//             Bucket: S3_BUCKET,
//             Key: fileName,
//         }
//         const command = new GetObjectCommand(s3params);
//         const response = await s3Client.send(command);
//         // or transformToBuffer() depending on SDK version
//         const bodyBuffer = await response.Body.transformToByteArray(); 
//         const decompressed = await gunzip(bodyBuffer);
//         return JSON.parse(decompressed.toString("utf-8"));
//     } catch (err) {
//         console.error(`Error fetching ${fileName} from S3:`, err);
//         throw err;
//     }
// }

// AWS PREPPED FOR DECOMP AND REGULAR
export async function awsGet(fileName) {
    const { S3_REGION, S3_BUCKET } = process.env;
    const s3Client = new S3Client({ region: S3_REGION });

    try {
        const response = await s3Client.send(
            new GetObjectCommand({
                Bucket: S3_BUCKET,
                Key: fileName,
            })
        );

        // Convert response body to Buffer
        const bodyBuffer = await response.Body.transformToByteArray();

        // Detect gzip by magic numbers (0x1f 0x8b)
        const isGzip = bodyBuffer[0] === 0x1f && bodyBuffer[1] === 0x8b;
        const rawData = isGzip ? await gunzip(bodyBuffer) : bodyBuffer;

        // Parse JSON safely
        try {
            return JSON.parse(rawData.toString("utf-8"));
        } catch (jsonErr) {
            console.error(
                `Failed to parse JSON from ${fileName}, first 50 bytes:`,
                rawData.slice(0, 50).toString("utf-8")
            );
            throw jsonErr;
        }
    } catch (err) {
        console.error(`Error fetching ${fileName} from S3:`, err);
        throw err;
    }
}

export async function awsPut(fileName, fileData) {
    const { S3_REGION, S3_BUCKET } = process.env;
    const s3Client = new S3Client({ region: S3_REGION });

    try {
        const s3Params = {
            Bucket: S3_BUCKET,
            Key: fileName,
            Body: Buffer.from(await gzip(JSON.stringify(fileData))),
            ContentType: "application/json",
            ContentEncoding: "gzip",
            Metadata: {
                source: "firemap",
                compressed: "true"
            }
        };
        await s3Client.send(new PutObjectCommand(s3Params));
    } catch (err) {
        console.error(`Error uploading ${fileName} to S3:`, err);
        throw err;
    }
};