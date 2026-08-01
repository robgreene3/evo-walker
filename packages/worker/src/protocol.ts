import type { PeriodicControllerGenome } from "@evowalker/core";
import type { FitnessComponents } from "@evowalker/sim";

export const WORKER_PROTOCOL_VERSION = 1 as const;
export interface BatchEvaluationRequest {
  readonly kind: "evaluate";
  readonly protocolVersion: number;
  readonly requestId: string;
  readonly genomes: readonly PeriodicControllerGenome[];
}
export interface CancelEvaluationRequest {
  readonly kind: "cancel";
  readonly protocolVersion: number;
  readonly requestId: string;
}
export type WorkerRequest = BatchEvaluationRequest | CancelEvaluationRequest;
export interface BatchEvaluationValue {
  readonly index: number;
  readonly genomeSeed: number;
  readonly aggregateFitness: number;
  readonly components: FitnessComponents;
  readonly invalidReason: string | null;
  readonly finalWorldChecksum: string;
}
export interface ProgressMessage {
  readonly kind: "progress";
  readonly protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly completed: number;
  readonly total: number;
}
export interface CompletedMessage {
  readonly kind: "completed";
  readonly protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly values: readonly BatchEvaluationValue[];
}
export interface CancelledMessage {
  readonly kind: "cancelled";
  readonly protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly completed: number;
}
export interface ErrorMessage {
  readonly kind: "error";
  readonly protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly message: string;
}
export type WorkerResponse =
  ProgressMessage | CompletedMessage | CancelledMessage | ErrorMessage;
