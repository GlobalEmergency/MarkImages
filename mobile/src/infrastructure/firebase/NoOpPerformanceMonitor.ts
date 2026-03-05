import { IPerformanceMonitor } from "../../domain/ports/IPerformanceMonitor";

/**
 * No-op implementation for web/dev where Firebase native SDKs are unavailable.
 */
export class NoOpPerformanceMonitor implements IPerformanceMonitor {
  async startTrace(traceName: string): Promise<void> {
    void traceName;
  }

  async stopTrace(traceName: string): Promise<void> {
    void traceName;
  }

  async putAttribute(traceName: string, attribute: string, value: string): Promise<void> {
    void traceName;
    void attribute;
    void value;
  }

  async incrementMetric(traceName: string, metricName: string, incrementBy = 1): Promise<void> {
    void traceName;
    void metricName;
    void incrementBy;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    void enabled;
  }
}
