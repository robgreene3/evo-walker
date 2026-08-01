import type {
  ControllerEvolutionSnapshot,
  GeneticAlgorithmConfig,
  PeriodicControllerGenome,
} from "@evowalker/core";
import type { EpisodeResult, FitnessComponents } from "@evowalker/sim";

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
export interface StartEvolutionRequest {
  readonly kind: "evolve";
  readonly protocolVersion: number;
  readonly requestId: string;
  readonly config: GeneticAlgorithmConfig;
}
export interface PauseEvolutionRequest {
  readonly kind: "pause";
  readonly protocolVersion: number;
  readonly requestId: string;
}
export interface ResumeEvolutionRequest {
  readonly kind: "resume";
  readonly protocolVersion: number;
  readonly requestId: string;
}
export type WorkerRequest =
  | BatchEvaluationRequest
  | CancelEvaluationRequest
  | StartEvolutionRequest
  | PauseEvolutionRequest
  | ResumeEvolutionRequest;
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
export interface EvolutionProgressMessage {
  readonly kind: "evolution-progress";
  readonly protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly snapshot: ControllerEvolutionSnapshot;
  readonly championEpisode: EpisodeResult;
}
export interface EvolutionPausedMessage {
  readonly kind: "evolution-paused";
  readonly protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly generation: number;
}
export interface EvolutionResumedMessage {
  readonly kind: "evolution-resumed";
  readonly protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly generation: number;
}
export interface EvolutionCompletedMessage {
  readonly kind: "evolution-completed";
  readonly protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly snapshot: ControllerEvolutionSnapshot;
  readonly championEpisode: EpisodeResult;
}
export interface EvolutionCancelledMessage {
  readonly kind: "evolution-cancelled";
  readonly protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly snapshot: ControllerEvolutionSnapshot;
  readonly championEpisode: EpisodeResult;
}
export type WorkerResponse =
  | ProgressMessage
  | CompletedMessage
  | CancelledMessage
  | ErrorMessage
  | EvolutionProgressMessage
  | EvolutionPausedMessage
  | EvolutionResumedMessage
  | EvolutionCompletedMessage
  | EvolutionCancelledMessage;
