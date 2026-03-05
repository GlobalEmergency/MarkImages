export interface RecordExceptionOptions {
  code?: number;
  domain?: string;
}

export interface ICrashReporter {
  /** Initialize the crash reporter (called once at app startup) */
  initialize(): Promise<void>;

  /** Log a non-fatal exception/error */
  recordException(message: string, options?: RecordExceptionOptions): Promise<void>;

  /** Add a log message that will be attached to the next crash report */
  log(message: string): Promise<void>;

  /** Set a custom key-value pair for crash report context */
  setCustomKey(key: string, value: string | number | boolean): Promise<void>;

  /** Associate a user ID with crash reports */
  setUserId(userId: string): Promise<void>;

  /** Clear user ID (on logout) */
  clearUserId(): Promise<void>;

  /** Enable or disable crash reporting */
  setEnabled(enabled: boolean): Promise<void>;
}
