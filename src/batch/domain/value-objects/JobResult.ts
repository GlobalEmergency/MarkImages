/**
 * Job Result Value Object
 *
 * Represents the final result of a batch job after completion.
 * Contains statistics, outputs, and any artifacts produced.
 */

import { JobProgress } from "./JobProgress";

export interface JobError {
  index: number;
  recordId?: string;
  recordReference?: string;
  errorType: string;
  errorMessage: string;
  severity: "info" | "warning" | "error" | "critical";
  timestamp: Date;
  rowData?: Record<string, unknown>;
  correctionSuggestion?: string;
}

export interface JobArtifact {
  type: "file" | "url" | "data";
  name: string;
  description?: string;
  mimeType?: string;
  size?: number;
  url?: string;
  data?: unknown;
  createdAt: Date;
  expiresAt?: Date;
}

export interface JobResultSummary {
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  skippedRecords: number;
  warningRecords: number;
  createdRecords: number;
  updatedRecords: number;
  deletedRecords: number;
  durationMs: number;
  averageTimePerRecordMs: number;
}

export interface JobResultData {
  summary: JobResultSummary;
  errors: JobError[];
  warnings: JobError[];
  artifacts: JobArtifact[];
  metadata: Record<string, unknown>;
  completedAt: Date | null;
}

export class JobResult {
  private readonly data: JobResultData;

  private constructor(data: JobResultData) {
    this.data = Object.freeze({ ...data });
  }

  static create(data: Partial<JobResultData> = {}): JobResult {
    return new JobResult({
      summary: data.summary ?? {
        totalRecords: 0,
        successfulRecords: 0,
        failedRecords: 0,
        skippedRecords: 0,
        warningRecords: 0,
        createdRecords: 0,
        updatedRecords: 0,
        deletedRecords: 0,
        durationMs: 0,
        averageTimePerRecordMs: 0,
      },
      errors: data.errors ?? [],
      warnings: data.warnings ?? [],
      artifacts: data.artifacts ?? [],
      metadata: data.metadata ?? {},
      completedAt: data.completedAt ?? null,
    });
  }

  static empty(): JobResult {
    return JobResult.create();
  }

  static fromProgress(progress: JobProgress): JobResult {
    return JobResult.create({
      summary: {
        totalRecords: progress.totalRecords,
        successfulRecords: progress.successfulRecords,
        failedRecords: progress.failedRecords,
        skippedRecords: progress.skippedRecords,
        warningRecords: progress.warningRecords,
        createdRecords: 0,
        updatedRecords: 0,
        deletedRecords: 0,
        durationMs: progress.elapsedMs,
        averageTimePerRecordMs: progress.averageTimePerRecordMs,
      },
      completedAt: new Date(),
    });
  }

  // Getters
  get summary(): JobResultSummary {
    return this.data.summary;
  }

  get errors(): JobError[] {
    return [...this.data.errors];
  }

  get warnings(): JobError[] {
    return [...this.data.warnings];
  }

  get artifacts(): JobArtifact[] {
    return [...this.data.artifacts];
  }

  get metadata(): Record<string, unknown> {
    return { ...this.data.metadata };
  }

  get completedAt(): Date | null {
    return this.data.completedAt;
  }

  // Computed properties
  get hasErrors(): boolean {
    return this.data.errors.length > 0;
  }

  get hasWarnings(): boolean {
    return this.data.warnings.length > 0;
  }

  get hasArtifacts(): boolean {
    return this.data.artifacts.length > 0;
  }

  get isSuccessful(): boolean {
    return this.data.summary.failedRecords === 0;
  }

  get errorCount(): number {
    return this.data.errors.length;
  }

  get warningCount(): number {
    return this.data.warnings.length;
  }

  get criticalErrors(): JobError[] {
    return this.data.errors.filter((e) => e.severity === "critical");
  }

  // Immutable update methods
  withSummary(summary: Partial<JobResultSummary>): JobResult {
    return JobResult.create({
      ...this.data,
      summary: {
        ...this.data.summary,
        ...summary,
      },
    });
  }

  addError(error: Omit<JobError, "timestamp">): JobResult {
    return JobResult.create({
      ...this.data,
      errors: [...this.data.errors, { ...error, timestamp: new Date() }],
    });
  }

  addWarning(warning: Omit<JobError, "timestamp" | "severity">): JobResult {
    return JobResult.create({
      ...this.data,
      warnings: [...this.data.warnings, { ...warning, severity: "warning", timestamp: new Date() }],
    });
  }

  addArtifact(artifact: Omit<JobArtifact, "createdAt">): JobResult {
    return JobResult.create({
      ...this.data,
      artifacts: [...this.data.artifacts, { ...artifact, createdAt: new Date() }],
    });
  }

  withMetadata(key: string, value: unknown): JobResult {
    return JobResult.create({
      ...this.data,
      metadata: {
        ...this.data.metadata,
        [key]: value,
      },
    });
  }

  complete(): JobResult {
    return JobResult.create({
      ...this.data,
      completedAt: new Date(),
    });
  }

  incrementCreated(count: number = 1): JobResult {
    return this.withSummary({
      createdRecords: this.data.summary.createdRecords + count,
    });
  }

  incrementUpdated(count: number = 1): JobResult {
    return this.withSummary({
      updatedRecords: this.data.summary.updatedRecords + count,
    });
  }

  incrementDeleted(count: number = 1): JobResult {
    return this.withSummary({
      deletedRecords: this.data.summary.deletedRecords + count,
    });
  }

  // Serialization
  toJSON(): JobResultData {
    return {
      ...this.data,
      errors: this.data.errors.map((e) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      })),
      warnings: this.data.warnings.map((w) => ({
        ...w,
        timestamp: new Date(w.timestamp),
      })),
      artifacts: this.data.artifacts.map((a) => ({
        ...a,
        createdAt: new Date(a.createdAt),
        expiresAt: a.expiresAt ? new Date(a.expiresAt) : undefined,
      })),
    };
  }

  static fromJSON(json: JobResultData): JobResult {
    return JobResult.create({
      ...json,
      completedAt: json.completedAt ? new Date(json.completedAt) : null,
      errors: json.errors.map((e) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      })),
      warnings: json.warnings.map((w) => ({
        ...w,
        timestamp: new Date(w.timestamp),
      })),
      artifacts: json.artifacts.map((a) => ({
        ...a,
        createdAt: new Date(a.createdAt),
        expiresAt: a.expiresAt ? new Date(a.expiresAt) : undefined,
      })),
    });
  }

  /**
   * Generate a human-readable summary
   */
  toSummaryText(): string {
    const { summary } = this.data;
    const lines: string[] = [];

    lines.push(`Total: ${summary.totalRecords} registros`);
    lines.push(`Exitosos: ${summary.successfulRecords}`);

    if (summary.createdRecords > 0) {
      lines.push(`Creados: ${summary.createdRecords}`);
    }
    if (summary.updatedRecords > 0) {
      lines.push(`Actualizados: ${summary.updatedRecords}`);
    }
    if (summary.deletedRecords > 0) {
      lines.push(`Eliminados: ${summary.deletedRecords}`);
    }
    if (summary.skippedRecords > 0) {
      lines.push(`Omitidos: ${summary.skippedRecords}`);
    }
    if (summary.failedRecords > 0) {
      lines.push(`Fallidos: ${summary.failedRecords}`);
    }
    if (summary.warningRecords > 0) {
      lines.push(`Advertencias: ${summary.warningRecords}`);
    }

    const durationSec = Math.round(summary.durationMs / 1000);
    lines.push(`Duración: ${durationSec} segundos`);

    return lines.join("\n");
  }
}
