import { ICrashReporter, RecordExceptionOptions } from "../../domain/ports/ICrashReporter";

/**
 * No-op implementation for web/dev where Firebase native SDKs are unavailable.
 */
export class NoOpCrashReporter implements ICrashReporter {
  async initialize(): Promise<void> {
    // No-op on web
  }

  async recordException(message: string, options?: RecordExceptionOptions): Promise<void> {
    void options;
    console.warn("[CrashReporter] Non-fatal exception:", message);
  }

  async log(message: string): Promise<void> {
    void message;
  }

  async setCustomKey(key: string, value: string | number | boolean): Promise<void> {
    void key;
    void value;
  }

  async setUserId(userId: string): Promise<void> {
    void userId;
  }

  async clearUserId(): Promise<void> {
    // No-op on web
  }

  async setEnabled(enabled: boolean): Promise<void> {
    void enabled;
  }
}
