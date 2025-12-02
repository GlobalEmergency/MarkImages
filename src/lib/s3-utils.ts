/**
 * S3 Utilities - Image path generation with security
 * Infrastructure Layer - Helpers
 */

import { randomBytes } from "crypto";

export type ImageVariant = "original" | "processed" | "thumb";

/**
 * Generate a cryptographically secure random hash for original images
 * @returns 8-character hexadecimal string (4 bytes)
 */
export function generateSecurityHash(): string {
  return randomBytes(4).toString("hex");
}

/**
 * Build S3 key (path) for an image following the new structure:
 * /AEDID/IMAGEID_original_HASH.ext (original with security hash)
 * /AEDID/IMAGEID.ext (processed, no hash - already verified)
 * /AEDID/IMAGEID_thumb.ext (thumbnail, no hash)
 *
 * @param aedId - UUID of the AED
 * @param imageId - UUID of the image
 * @param variant - Type of image (original/processed/thumb)
 * @param extension - File extension without dot (jpg, png, etc.)
 * @returns S3 key path
 */
export function buildImageKey(
  aedId: string,
  imageId: string,
  variant: ImageVariant,
  extension: string = "jpg"
): string {
  // Remove dot from extension if present
  const ext = extension.replace(/^\./, "");
  const base = `${aedId}/${imageId}`;

  switch (variant) {
    case "original": {
      const hash = generateSecurityHash();
      return `${base}_original_${hash}.${ext}`;
    }

    case "processed":
      return `${base}.${ext}`;

    case "thumb":
      return `${base}_thumb.${ext}`;

    default:
      throw new Error(`Unknown image variant: ${variant}`);
  }
}

/**
 * Extract extension from filename or URL
 * @param filename - Filename or URL
 * @returns Extension without dot (defaults to 'jpg')
 */
export function extractExtension(filename: string): string {
  const match = filename.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? match[1].toLowerCase() : "jpg";
}

/**
 * Parse S3 URL to extract components
 * @param url - Full S3 URL
 * @returns Parsed components or null if invalid
 */
export function parseS3Url(url: string): {
  aedId: string;
  imageId: string;
  variant: ImageVariant;
  hash?: string;
  extension: string;
} | null {
  // Example: https://bucket.s3.region.amazonaws.com/aedId/imageId_original_hash.jpg
  const match = url.match(
    /\/([a-f0-9-]+)\/([a-f0-9-]+)(?:_original_([a-f0-9]{8}))?(?:_thumb)?\.([a-zA-Z0-9]+)/i
  );

  if (!match) return null;

  const [, aedId, imageId, hash, extension] = match;

  let variant: ImageVariant = "processed";
  if (hash) {
    variant = "original";
  } else if (url.includes("_thumb")) {
    variant = "thumb";
  }

  return {
    aedId,
    imageId,
    variant,
    hash,
    extension,
  };
}

/**
 * Build public S3 URL
 * @param bucket - S3 bucket name
 * @param region - AWS region
 * @param key - S3 key (path)
 * @returns Full public URL
 */
export function buildS3Url(bucket: string, region: string, key: string): string {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}
