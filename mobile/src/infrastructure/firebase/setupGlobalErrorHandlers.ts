import { ICrashReporter } from "../../domain/ports/ICrashReporter";

/**
 * Captures unhandled JS errors and promise rejections,
 * forwarding them to the crash reporter as non-fatal exceptions.
 */
export function setupGlobalErrorHandlers(crashReporter: ICrashReporter): void {
  window.addEventListener("error", (event) => {
    crashReporter
      .recordException(`Unhandled error: ${event.message} at ${event.filename}:${event.lineno}`)
      .catch(() => {});
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    crashReporter.recordException(`Unhandled promise rejection: ${reason}`).catch(() => {});
  });
}
