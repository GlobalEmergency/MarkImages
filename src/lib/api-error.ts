/**
 * Standardized API error response builder.
 *
 * Ensures consistent error shape across all API routes:
 * { success: false, error: "<message>" }
 *
 * In development, adds `details` with the original error message.
 */

import { NextResponse } from "next/server";

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Create a standardized JSON error response.
 *
 * @param message - Public-facing error message (safe for production)
 * @param status - HTTP status code (default: 500)
 * @param error - Optional original error (details exposed only in development)
 */
export function apiError(message: string, status: number = 500, error?: unknown): NextResponse {
  const body: Record<string, unknown> = {
    success: false,
    error: message,
  };

  if (isDevelopment && error) {
    body.details = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json(body, { status });
}
