import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { getS3Client, getS3BucketName, getS3Region } from "@/lib/s3";
import { buildS3Url } from "@/lib/s3-utils";

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const PRESIGN_EXPIRES_IN = 300; // 5 minutes

/**
 * POST /api/upload/presign
 *
 * Returns a presigned S3 PUT URL so the client can upload directly to S3,
 * bypassing the Vercel serverless function body-size limit (4.5 MB).
 *
 * Request body: { filename: string, contentType: string, prefix?: string }
 * Response:     { uploadUrl: string, publicUrl: string, key: string }
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);

    const body = await request.json();
    const { filename, contentType, prefix = "dea-community" } = body;

    if (!filename || typeof filename !== "string") {
      return NextResponse.json({ error: "filename is required" }, { status: 400 });
    }

    if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json(
        {
          error: `Invalid content type. Allowed: ${[...ALLOWED_CONTENT_TYPES].join(", ")}`,
        },
        { status: 400 }
      );
    }

    const bucketName = getS3BucketName();
    const region = getS3Region();

    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `${prefix}/${timestamp}-${sanitizedFilename}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
      ACL: "public-read",
    });

    const uploadUrl = await getSignedUrl(getS3Client(), command, {
      expiresIn: PRESIGN_EXPIRES_IN,
      signableHeaders: new Set(["content-type"]),
    });

    const publicUrl = buildS3Url(bucketName, region, key);

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      key,
      maxSizeBytes: MAX_SIZE_BYTES,
      success: true,
    });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error generating upload URL",
      },
      { status: 500 }
    );
  }
}
