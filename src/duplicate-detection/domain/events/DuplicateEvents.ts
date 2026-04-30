/**
 * DuplicateEvents — Domain events for duplicate detection
 *
 * Simple in-process event bus. Subscribers can react to
 * duplicate detection events for logging, metrics, notifications, etc.
 */

import type { DuplicateCriteria } from "../value-objects/DuplicateCriteria";
import type { DetectionResult } from "../value-objects/DetectionResult";

export interface DuplicateDetectedEvent {
  type: "duplicate.confirmed" | "duplicate.possible";
  timestamp: Date;
  criteria: DuplicateCriteria;
  result: DetectionResult;
  context?: {
    source: "web_form" | "csv_import" | "external_sync" | "api";
    userId?: string;
    jobId?: string;
  };
}

export type DuplicateEventHandler = (event: DuplicateDetectedEvent) => void | Promise<void>;

export class DuplicateEventBus {
  private handlers: DuplicateEventHandler[] = [];

  /** Subscribe to duplicate detection events. Returns unsubscribe function. */
  subscribe(handler: DuplicateEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  /** Emit an event to all subscribers. Errors in handlers don't propagate. */
  async emit(event: DuplicateDetectedEvent): Promise<void> {
    await Promise.allSettled(this.handlers.map(async (h) => h(event)));
  }
}

/** Singleton global event bus */
export const duplicateEventBus = new DuplicateEventBus();
