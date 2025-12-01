import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "eu-west-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export interface UploadOptions {
  buffer: Buffer;
  filename: string;
  contentType: string;
  prefix?: string;
}

export async function uploadToS3({
  buffer,
  filename,
  contentType,
  prefix = "dea-foto",
}: UploadOptions): Promise<string> {
  const bucketName = process.env.AWS_S3_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("AWS_S3_BUCKET_NAME is not configured");
  }

  // Generate unique filename with timestamp
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `${prefix}/${timestamp}-${sanitizedFilename}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: "public-read", // Make the file publicly accessible
  });

  await s3Client.send(command);

  // Return the public URL
  // Format: https://bucket-name.s3.region.amazonaws.com/key
  const region = process.env.AWS_REGION || "eu-west-1";
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}
