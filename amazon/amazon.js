import { S3Client, GetObjectCommand, PutObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
const { S3_REGION, S3_BUCKET } = process.env;
const s3Client = new S3Client({ region: S3_REGION });

export async function awsCopy(sourceKey, destKey) {
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
    try {
        const s3params = {
            Bucket: S3_BUCKET,
            Key: fileName,
        }
        const command = new GetObjectCommand(s3params);
        const response = await s3Client.send(command);
        const body = await response.Body.transformToString();
        return JSON.parse(body);
    } catch (err) {
        console.error(`Error fetching ${fileName} from S3:`, err);
        throw err;
    }
}

export async function awsPut(fileName, fileData) {
    try {
        const s3Params = {
            Bucket: S3_BUCKET,
            Key: fileName,
            Body: JSON.stringify(fileData),
            ContentType: "application/json",
        };
        await s3Client.send(new PutObjectCommand(s3Params));
    } catch (err) {
        console.error(`Error uploading ${fileName} to S3:`, err);
        throw err;
    }
};