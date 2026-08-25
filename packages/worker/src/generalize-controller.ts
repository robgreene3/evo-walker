import {
  EPISODE_DURATION_OPTIONS,
  TERRAIN_GENERATOR_VERSION,
  TERRAIN_KINDS,
  validateControllerGenome,
  type TerrainConfig,
} from "@evowalker/core";
import {
  DEFAULT_EPISODE_CONFIG,
  runDeterministicEpisode,
} from "@evowalker/sim";
import {
  WORKER_PROTOCOL_VERSION,
  type GeneralizationCompletedMessage,
  type GeneralizationCourseResult,
  type GeneralizationRequest,
} from "./protocol.js";

function validateRequest(request: GeneralizationRequest): void {
  if (request.protocolVersion !== WORKER_PROTOCOL_VERSION) {
    throw new RangeError("Unsupported worker protocol version.");
  }
  if (request.requestId.length === 0 || request.requestId.length > 128) {
    throw new RangeError("Worker request ID must contain 1 to 128 characters.");
  }
  validateControllerGenome(request.genome);
  if (!Number.isSafeInteger(request.terrainSeed)) {
    throw new TypeError("Terrain seed must be a safe integer.");
  }
  if (!EPISODE_DURATION_OPTIONS.includes(request.episodeDurationSeconds)) {
    throw new RangeError("Episode duration must be 6 or 30 seconds.");
  }
}

export function generalizeController(
  request: GeneralizationRequest,
): GeneralizationCompletedMessage {
  validateRequest(request);
  const courses: GeneralizationCourseResult[] = TERRAIN_KINDS.map((kind) => {
    const terrain: TerrainConfig = {
      kind,
      seed: request.terrainSeed,
      generatorVersion: TERRAIN_GENERATOR_VERSION,
    };
    const episode = runDeterministicEpisode(request.genome, {
      ...DEFAULT_EPISODE_CONFIG,
      terrain,
      durationSeconds: request.episodeDurationSeconds,
    });
    return {
      terrain,
      label: episode.terrain.label,
      aggregateFitness: episode.aggregateFitness,
      forwardProgress: episode.components.forwardProgress,
      viable: episode.viable,
      obstaclesCleared: episode.terrain.obstaclesCleared,
      obstaclesTotal: episode.terrain.obstaclesTotal,
      invalidReason: episode.invalidReason,
      finalWorldChecksum: episode.finalWorldChecksum,
    };
  });
  const fitnessValues = courses.map((course) => course.aggregateFitness);
  return {
    kind: "generalization-completed",
    protocolVersion: WORKER_PROTOCOL_VERSION,
    requestId: request.requestId,
    courses,
    viableCourses: courses.filter((course) => course.viable).length,
    meanAggregateFitness:
      fitnessValues.reduce((sum, fitness) => sum + fitness, 0) /
      fitnessValues.length,
    worstAggregateFitness: Math.min(...fitnessValues),
  };
}
