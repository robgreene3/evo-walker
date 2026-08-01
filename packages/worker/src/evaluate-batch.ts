import { validateControllerGenome } from "@evowalker/core";
import { runDeterministicEpisode } from "@evowalker/sim";
import {
  WORKER_PROTOCOL_VERSION,
  type BatchEvaluationRequest,
  type BatchEvaluationValue,
  type CancelledMessage,
  type CompletedMessage,
  type ProgressMessage,
} from "./protocol.js";

export interface BatchEvaluationHooks {
  readonly isCancelled?: () => boolean;
  readonly onProgress?: (message: ProgressMessage) => void;
  readonly yieldControl?: () => Promise<void>;
}
export type BatchEvaluationTerminal = CompletedMessage | CancelledMessage;

export function validateBatchEvaluationRequest(
  request: BatchEvaluationRequest,
): void {
  if (request.protocolVersion !== WORKER_PROTOCOL_VERSION)
    throw new RangeError("Unsupported worker protocol version.");
  if (request.requestId.length === 0 || request.requestId.length > 128)
    throw new RangeError("Worker request ID must contain 1 to 128 characters.");
  if (request.genomes.length === 0 || request.genomes.length > 1_000)
    throw new RangeError("Worker batch must contain 1 to 1000 genomes.");
  request.genomes.forEach(validateControllerGenome);
}

export async function evaluateBatch(
  request: BatchEvaluationRequest,
  hooks: BatchEvaluationHooks = {},
): Promise<BatchEvaluationTerminal> {
  validateBatchEvaluationRequest(request);
  const values: BatchEvaluationValue[] = [];
  for (const [index, genome] of request.genomes.entries()) {
    if (hooks.isCancelled?.() === true)
      return {
        kind: "cancelled",
        protocolVersion: WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        completed: values.length,
      };
    const result = runDeterministicEpisode(genome);
    values.push({
      index,
      genomeSeed: genome.seed,
      aggregateFitness: result.aggregateFitness,
      components: result.components,
      invalidReason: result.invalidReason,
      finalWorldChecksum: result.finalWorldChecksum,
    });
    hooks.onProgress?.({
      kind: "progress",
      protocolVersion: WORKER_PROTOCOL_VERSION,
      requestId: request.requestId,
      completed: values.length,
      total: request.genomes.length,
    });
    await hooks.yieldControl?.();
  }
  return {
    kind: "completed",
    protocolVersion: WORKER_PROTOCOL_VERSION,
    requestId: request.requestId,
    values,
  };
}
