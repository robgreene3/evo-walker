import {
  TERRAIN_GENERATOR_VERSION,
  TERRAIN_KINDS,
  createSeededController,
} from "@evowalker/core";
import {
  DEFAULT_EPISODE_CONFIG,
  runDeterministicEpisode,
} from "@evowalker/sim";
import { describe, expect, it } from "vitest";
import {
  WORKER_PROTOCOL_VERSION,
  generalizeController,
  type GeneralizationRequest,
} from "../src/index.js";

describe("controller generalization protocol", () => {
  it("matches direct deterministic simulation across every terrain", () => {
    const genome = createSeededController(12_345);
    const request: GeneralizationRequest = {
      kind: "generalize",
      protocolVersion: WORKER_PROTOCOL_VERSION,
      requestId: "generalization-test",
      genome,
      terrainSeed: 77,
      episodeDurationSeconds: 6,
    };
    const result = generalizeController(request);

    expect(result.courses).toHaveLength(TERRAIN_KINDS.length);
    TERRAIN_KINDS.forEach((kind, index) => {
      const course = result.courses[index];
      if (course === undefined) throw new Error("Missing terrain result.");
      const terrain = {
        kind,
        seed: request.terrainSeed,
        generatorVersion: TERRAIN_GENERATOR_VERSION,
      } as const;
      const direct = runDeterministicEpisode(genome, {
        ...DEFAULT_EPISODE_CONFIG,
        terrain,
        durationSeconds: request.episodeDurationSeconds,
      });
      expect(course).toEqual({
        terrain,
        label: direct.terrain.label,
        aggregateFitness: direct.aggregateFitness,
        forwardProgress: direct.components.forwardProgress,
        viable: direct.viable,
        obstaclesCleared: direct.terrain.obstaclesCleared,
        obstaclesTotal: direct.terrain.obstaclesTotal,
        invalidReason: direct.invalidReason,
        finalWorldChecksum: direct.finalWorldChecksum,
      });
    });
    expect(result.viableCourses).toBe(
      result.courses.filter((course) => course.viable).length,
    );
    expect(result.meanAggregateFitness).toBe(
      result.courses.reduce((sum, course) => sum + course.aggregateFitness, 0) /
        result.courses.length,
    );
    expect(result.worstAggregateFitness).toBe(
      Math.min(...result.courses.map((course) => course.aggregateFitness)),
    );
  });

  it("rejects an invalid terrain seed before simulation", () => {
    expect(() =>
      generalizeController({
        kind: "generalize",
        protocolVersion: WORKER_PROTOCOL_VERSION,
        requestId: "invalid-generalization",
        genome: createSeededController(9),
        terrainSeed: Number.NaN,
        episodeDurationSeconds: 6,
      }),
    ).toThrow("Terrain seed must be a safe integer.");
  });
});
