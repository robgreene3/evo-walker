import {
  ControllerEvolutionSession,
  type PeriodicControllerGenome,
} from "@evowalker/core";
import { runDeterministicEpisode, type EpisodeResult } from "@evowalker/sim";

import {
  WORKER_PROTOCOL_VERSION,
  type EvolutionCancelledMessage,
  type EvolutionCompletedMessage,
  type EvolutionProgressMessage,
  type StartEvolutionRequest,
} from "./protocol.js";

export interface EvolutionHooks {
  readonly isCancelled?: () => boolean;
  readonly onProgress?: (message: EvolutionProgressMessage) => void;
  readonly waitWhilePaused?: () => Promise<void>;
  readonly yieldControl?: () => Promise<void>;
}

export type EvolutionTerminal =
  EvolutionCompletedMessage | EvolutionCancelledMessage;

function validateRequest(request: StartEvolutionRequest): void {
  if (request.protocolVersion !== WORKER_PROTOCOL_VERSION) {
    throw new RangeError("Unsupported worker protocol version.");
  }
  if (request.requestId.length === 0 || request.requestId.length > 128) {
    throw new RangeError("Worker request ID must contain 1 to 128 characters.");
  }
}

export async function evolveExperiment(
  request: StartEvolutionRequest,
  hooks: EvolutionHooks = {},
): Promise<EvolutionTerminal> {
  validateRequest(request);
  const episodes = new WeakMap<PeriodicControllerGenome, EpisodeResult>();
  const session = new ControllerEvolutionSession(request.config, (genome) => {
    const result = runDeterministicEpisode(genome);
    episodes.set(genome, result);
    return result.aggregateFitness;
  });

  const progress = (): EvolutionProgressMessage => {
    const snapshot = session.snapshot();
    const championEpisode = episodes.get(snapshot.champion.genome);
    if (championEpisode === undefined) {
      throw new Error("Champion episode was not retained after evaluation.");
    }
    const message: EvolutionProgressMessage = {
      kind: "evolution-progress",
      protocolVersion: WORKER_PROTOCOL_VERSION,
      requestId: request.requestId,
      snapshot,
      championEpisode,
    };
    hooks.onProgress?.(message);
    return message;
  };

  let latest = progress();
  while (!latest.snapshot.complete) {
    await hooks.yieldControl?.();
    if (hooks.isCancelled?.() === true) {
      return {
        kind: "evolution-cancelled",
        protocolVersion: WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        snapshot: latest.snapshot,
        championEpisode: latest.championEpisode,
      };
    }
    await hooks.waitWhilePaused?.();
    if (hooks.isCancelled?.() === true) {
      return {
        kind: "evolution-cancelled",
        protocolVersion: WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        snapshot: latest.snapshot,
        championEpisode: latest.championEpisode,
      };
    }
    session.advanceGeneration();
    latest = progress();
  }

  return {
    kind: "evolution-completed",
    protocolVersion: WORKER_PROTOCOL_VERSION,
    requestId: request.requestId,
    snapshot: latest.snapshot,
    championEpisode: latest.championEpisode,
  };
}
