/**
 * Get the application URL based on the environment
 * This function automatically detects the correct URL for:
 * - Production (uses custom domain or NEXT_PUBLIC_APP_URL)
 * - Preview/Branch deployments (uses Vercel's automatic URL)
 * - Local development (uses localhost)
 */
export function getAppUrl(): string {
  // If explicitly set, use that (useful for custom domains in production)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Vercel automatically provides VERCEL_URL for all deployments
  // This includes branch previews like: your-app-git-branch-name.vercel.app
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Fallback to localhost for local development
  return "http://localhost:3000";
}
