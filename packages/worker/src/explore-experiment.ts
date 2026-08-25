import {
  QualityDiversitySession,
  type PeriodicControllerGenome,
} from "@evowalker/core";
import {
  DEFAULT_EPISODE_CONFIG,
  runDeterministicEpisode,
  type EpisodeResult,
} from "@evowalker/sim";

import {
  WORKER_PROTOCOL_VERSION,
  type ExplorationProgressMessage,
  type ExplorationStoppedMessage,
  type StartExplorationRequest,
} from "./protocol.js";

export interface ExplorationHooks {
  readonly isCancelled?: () => boolean;
  readonly onProgress?: (message: ExplorationProgressMessage) => void;
  readonly waitWhilePaused?: () => Promise<void>;
  readonly yieldControl?: () => Promise<void>;
}

function validateRequest(request: StartExplorationRequest): void {
  if (request.protocolVersion !== WORKER_PROTOCOL_VERSION) {
    throw new RangeError("Unsupported worker protocol version.");
  }
  if (request.requestId.length === 0 || request.requestId.length > 128) {
    throw new RangeError("Worker request ID must contain 1 to 128 characters.");
  }
}

export async function exploreExperiment(
  request: StartExplorationRequest,
  hooks: ExplorationHooks = {},
): Promise<ExplorationStoppedMessage> {
  validateRequest(request);
  const episodes = new WeakMap<PeriodicControllerGenome, EpisodeResult>();
  const episodeConfig = Object.freeze({
    ...DEFAULT_EPISODE_CONFIG,
    terrain: request.config.terrain,
    durationSeconds: request.config.episodeDurationSeconds,
  });
  const session = new QualityDiversitySession(
    request.config,
    (genome) => {
      const episode = runDeterministicEpisode(genome, episodeConfig);
      episodes.set(genome, episode);
      return {
        fitness: episode.aggregateFitness,
        behavior: episode.gait,
        viable: episode.viable,
      };
    },
    request.checkpoint,
  );

  const championEpisode = (): EpisodeResult | null => {
    const champion = session.snapshot().champion;
    if (champion === null) return null;
    const retained = episodes.get(champion.genome);
    if (retained !== undefined) return retained;
    const replay = runDeterministicEpisode(champion.genome, episodeConfig);
    episodes.set(champion.genome, replay);
    return replay;
  };
  const progress = (championChanged: boolean): ExplorationProgressMessage => {
    const message: ExplorationProgressMessage = {
      kind: "exploration-progress",
      protocolVersion: WORKER_PROTOCOL_VERSION,
      requestId: request.requestId,
      snapshot: session.snapshot(),
      championEpisode: championEpisode(),
      championChanged,
    };
    hooks.onProgress?.(message);
    return message;
  };

  let latest = progress(true);
  for (;;) {
    await hooks.yieldControl?.();
    if (hooks.isCancelled?.() === true) break;
    await hooks.waitWhilePaused?.();
    if (hooks.isCancelled?.() === true) break;
    const step = session.advance();
    latest = progress(step.championChanged);
  }
  return {
    kind: "exploration-stopped",
    protocolVersion: WORKER_PROTOCOL_VERSION,
    requestId: request.requestId,
    snapshot: latest.snapshot,
    championEpisode: latest.championEpisode,
  };
}
