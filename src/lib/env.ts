/**
 * Environment variable validation
 *
 * Validates all required environment variables at startup.
 * Import this module early (e.g., in instrumentation.ts) to fail fast
 * if critical env vars are missing.
 */

import { z } from "zod";

const serverEnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Auth
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters")
    .optional()
    .refine(
      (val) => process.env.NODE_ENV !== "production" || (val && val.length >= 32),
      "JWT_SECRET is required in production and must be at least 32 characters"
    ),

  // AWS S3
  AWS_S3_BUCKET_NAME: z.string().min(1, "AWS_S3_BUCKET_NAME is required").optional(),
  AWS_REGION: z.string().default("eu-west-1"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // AWS SES (email)
  AWS_SES_FROM_EMAIL: z.string().email().optional(),

  // Google Maps
  GOOGLE_MAPS_API_KEY: z.string().optional(),

  // CDN
  CDN_BASE_URL: z.string().url().optional(),

  // App
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let _validatedEnv: ServerEnv | null = null;

/**
 * Validate and return server environment variables.
 * Caches the result after first successful validation.
 *
 * @throws {Error} If validation fails in production
 * @returns Validated environment variables
 */
export function getServerEnv(): ServerEnv {
  if (_validatedEnv) return _validatedEnv;

  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const errorMessage = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${(msgs ?? []).join(", ")}`)
      .join("\n");

    if (process.env.NODE_ENV === "production") {
      throw new Error(`âŒ Invalid environment variables:\n${errorMessage}`);
    }

    // In dev, allow continuing with partial env (use process.env directly)
    _validatedEnv = {
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      AWS_REGION: process.env.AWS_REGION ?? "eu-west-1",
      NODE_ENV: (process.env.NODE_ENV as ServerEnv["NODE_ENV"]) ?? "development",
      JWT_SECRET: process.env.JWT_SECRET,
      AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
      AWS_SES_FROM_EMAIL: process.env.AWS_SES_FROM_EMAIL,
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
      CDN_BASE_URL: process.env.CDN_BASE_URL,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    };
    return _validatedEnv;
  }

  _validatedEnv = result.data;
  return _validatedEnv;
}
