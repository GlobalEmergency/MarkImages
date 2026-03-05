import { FirebaseCrashlytics } from "@capacitor-firebase/crashlytics";
import { ICrashReporter, RecordExceptionOptions } from "../../domain/ports/ICrashReporter";

export class CapacitorCrashReporter implements ICrashReporter {
  async initialize(): Promise<void> {
    const { crashed } = await FirebaseCrashlytics.didCrashOnPreviousExecution();
    if (crashed) {
      await FirebaseCrashlytics.log({
        message: "App recovered from previous crash",
      });
    }
    await FirebaseCrashlytics.sendUnsentReports();
  }

  async recordException(message: string, options?: RecordExceptionOptions): Promise<void> {
    await FirebaseCrashlytics.recordException({
      message,
      code: options?.code,
      domain: options?.domain,
    });
  }

  async log(message: string): Promise<void> {
    await FirebaseCrashlytics.log({ message });
  }

  async setCustomKey(key: string, value: string | number | boolean): Promise<void> {
    const type =
      typeof value === "boolean"
        ? "boolean"
        : typeof value === "number"
          ? Number.isInteger(value)
            ? "int"
            : "double"
          : "string";

    await FirebaseCrashlytics.setCustomKey({
      key,
      value,
      type: type as "string" | "boolean" | "int" | "long" | "double" | "float",
    });
  }

  async setUserId(userId: string): Promise<void> {
    await FirebaseCrashlytics.setUserId({ userId });
  }

  async clearUserId(): Promise<void> {
    await FirebaseCrashlytics.setUserId({ userId: "" });
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await FirebaseCrashlytics.setEnabled({ enabled });
  }
}
