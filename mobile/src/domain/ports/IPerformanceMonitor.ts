export interface IPerformanceMonitor {
  /** Start a named performance trace */
  startTrace(traceName: string): Promise<void>;

  /** Stop a named performance trace */
  stopTrace(traceName: string): Promise<void>;

  /** Add a custom attribute to an active trace */
  putAttribute(traceName: string, attribute: string, value: string): Promise<void>;

  /** Increment a metric counter on an active trace */
  incrementMetric(traceName: string, metricName: string, incrementBy?: number): Promise<void>;

  /** Enable or disable performance monitoring */
  setEnabled(enabled: boolean): Promise<void>;
}
