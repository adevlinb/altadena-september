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

        const compressedBuffer = await response.Body.transformToByteArray();
        const rawBuffer = await gunzip(compressedBuffer);
        return JSON.parse(rawBuffer.toString("utf-8"));
    } catch (err) {
        console.error(`Error fetching ${fileName} from S3 or convertiing to json`, err);
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