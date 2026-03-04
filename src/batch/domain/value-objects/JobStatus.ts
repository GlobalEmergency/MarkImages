/**
 * Job Status Value Object
 *
 * Represents the lifecycle state of a batch job.
 * Designed for Vercel's serverless execution model where jobs
 * are executed in chunks across multiple invocations.
 */

export const JobStatus = {
  // Initial states
  PENDING: "PENDING", // Job created, waiting to start
  QUEUED: "QUEUED", // Job queued for processing

  // Active states
  IN_PROGRESS: "IN_PROGRESS", // Currently processing
  PAUSED: "PAUSED", // Paused by user, can be resumed
  WAITING: "WAITING", // Waiting for next chunk invocation

  // Terminal states
  COMPLETED: "COMPLETED", // Successfully completed
  COMPLETED_WITH_WARNINGS: "COMPLETED_WITH_WARNINGS", // Completed but with some warnings
  FAILED: "FAILED", // Failed completely
  CANCELLED: "CANCELLED", // Cancelled by user

  // Recovery states
  INTERRUPTED: "INTERRUPTED", // Interrupted (timeout, crash), can be resumed
  RESUMING: "RESUMING", // Being resumed from interruption
} as const;

// eslint-disable-next-line no-redeclare
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

/**
 * Status metadata for UI and logic
 */
export interface JobStatusMetadata {
  status: JobStatus;
  label: string;
  description: string;
  isTerminal: boolean;
  isActive: boolean;
  canResume: boolean;
  canCancel: boolean;
  color: "gray" | "blue" | "yellow" | "green" | "red" | "orange";
}

export const JOB_STATUS_METADATA: Record<JobStatus, JobStatusMetadata> = {
  [JobStatus.PENDING]: {
    status: JobStatus.PENDING,
    label: "Pendiente",
    description: "El trabajo está pendiente de iniciar",
    isTerminal: false,
    isActive: false,
    canResume: false,
    canCancel: true,
    color: "gray",
  },
  [JobStatus.QUEUED]: {
    status: JobStatus.QUEUED,
    label: "En cola",
    description: "El trabajo está en cola esperando procesamiento",
    isTerminal: false,
    isActive: false,
    canResume: false,
    canCancel: true,
    color: "gray",
  },
  [JobStatus.IN_PROGRESS]: {
    status: JobStatus.IN_PROGRESS,
    label: "En progreso",
    description: "El trabajo se está procesando actualmente",
    isTerminal: false,
    isActive: true,
    canResume: false,
    canCancel: true,
    color: "blue",
  },
  [JobStatus.PAUSED]: {
    status: JobStatus.PAUSED,
    label: "Pausado",
    description: "El trabajo está pausado por el usuario",
    isTerminal: false,
    isActive: false,
    canResume: true,
    canCancel: true,
    color: "yellow",
  },
  [JobStatus.WAITING]: {
    status: JobStatus.WAITING,
    label: "Esperando",
    description: "El trabajo espera la siguiente invocación",
    isTerminal: false,
    isActive: false,
    canResume: true,
    canCancel: true,
    color: "yellow",
  },
  [JobStatus.COMPLETED]: {
    status: JobStatus.COMPLETED,
    label: "Completado",
    description: "El trabajo se completó exitosamente",
    isTerminal: true,
    isActive: false,
    canResume: false,
    canCancel: false,
    color: "green",
  },
  [JobStatus.COMPLETED_WITH_WARNINGS]: {
    status: JobStatus.COMPLETED_WITH_WARNINGS,
    label: "Completado con advertencias",
    description: "El trabajo se completó pero con algunas advertencias",
    isTerminal: true,
    isActive: false,
    canResume: false,
    canCancel: false,
    color: "orange",
  },
  [JobStatus.FAILED]: {
    status: JobStatus.FAILED,
    label: "Fallido",
    description: "El trabajo falló",
    isTerminal: true,
    isActive: false,
    canResume: false,
    canCancel: false,
    color: "red",
  },
  [JobStatus.CANCELLED]: {
    status: JobStatus.CANCELLED,
    label: "Cancelado",
    description: "El trabajo fue cancelado por el usuario",
    isTerminal: true,
    isActive: false,
    canResume: false,
    canCancel: false,
    color: "gray",
  },
  [JobStatus.INTERRUPTED]: {
    status: JobStatus.INTERRUPTED,
    label: "Interrumpido",
    description: "El trabajo fue interrumpido y puede reanudarse",
    isTerminal: false,
    isActive: false,
    canResume: true,
    canCancel: true,
    color: "orange",
  },
  [JobStatus.RESUMING]: {
    status: JobStatus.RESUMING,
    label: "Reanudando",
    description: "El trabajo se está reanudando",
    isTerminal: false,
    isActive: true,
    canResume: false,
    canCancel: true,
    color: "blue",
  },
};

export function getJobStatusMetadata(status: JobStatus): JobStatusMetadata {
  return JOB_STATUS_METADATA[status];
}

export function isTerminalStatus(status: JobStatus): boolean {
  return JOB_STATUS_METADATA[status].isTerminal;
}

export function isActiveStatus(status: JobStatus): boolean {
  return JOB_STATUS_METADATA[status].isActive;
}

export function canResumeStatus(status: JobStatus): boolean {
  return JOB_STATUS_METADATA[status].canResume;
}

export function canCancelStatus(status: JobStatus): boolean {
  return JOB_STATUS_METADATA[status].canCancel;
}

export function isValidJobStatus(status: string): status is JobStatus {
  return Object.values(JobStatus).includes(status as JobStatus);
}

/**
 * Valid status transitions
 */
export const VALID_STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  [JobStatus.PENDING]: [
    JobStatus.QUEUED,
    JobStatus.IN_PROGRESS,
    JobStatus.CANCELLED,
    JobStatus.FAILED,
  ],
  [JobStatus.QUEUED]: [JobStatus.IN_PROGRESS, JobStatus.CANCELLED, JobStatus.FAILED],
  [JobStatus.IN_PROGRESS]: [
    JobStatus.WAITING,
    JobStatus.PAUSED,
    JobStatus.COMPLETED,
    JobStatus.COMPLETED_WITH_WARNINGS,
    JobStatus.FAILED,
    JobStatus.CANCELLED,
    JobStatus.INTERRUPTED,
  ],
  [JobStatus.PAUSED]: [JobStatus.IN_PROGRESS, JobStatus.RESUMING, JobStatus.CANCELLED],
  [JobStatus.WAITING]: [
    JobStatus.IN_PROGRESS,
    JobStatus.RESUMING,
    JobStatus.CANCELLED,
    JobStatus.INTERRUPTED,
    JobStatus.FAILED,
  ],
  [JobStatus.COMPLETED]: [],
  [JobStatus.COMPLETED_WITH_WARNINGS]: [],
  [JobStatus.FAILED]: [],
  [JobStatus.CANCELLED]: [],
  [JobStatus.INTERRUPTED]: [JobStatus.RESUMING, JobStatus.CANCELLED],
  [JobStatus.RESUMING]: [JobStatus.IN_PROGRESS, JobStatus.FAILED, JobStatus.CANCELLED],
};

export function isValidTransition(from: JobStatus, to: JobStatus): boolean {
  return VALID_STATUS_TRANSITIONS[from].includes(to);
}
