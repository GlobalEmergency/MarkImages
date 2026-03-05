import { FirebasePerformance } from "@capacitor-firebase/performance";
import { IPerformanceMonitor } from "../../domain/ports/IPerformanceMonitor";

export class CapacitorPerformanceMonitor implements IPerformanceMonitor {
  async startTrace(traceName: string): Promise<void> {
    await FirebasePerformance.startTrace({ traceName });
  }

  async stopTrace(traceName: string): Promise<void> {
    await FirebasePerformance.stopTrace({ traceName });
  }

  async putAttribute(traceName: string, attribute: string, value: string): Promise<void> {
    await FirebasePerformance.putAttribute({ traceName, attribute, value });
  }

  async incrementMetric(traceName: string, metricName: string, incrementBy = 1): Promise<void> {
    await FirebasePerformance.incrementMetric({
      traceName,
      metricName,
      incrementBy,
    });
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await FirebasePerformance.setEnabled({ enabled });
  }
}
