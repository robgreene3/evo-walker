import { createSeededController } from "@evowalker/core";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_EPISODE_CONFIG,
  DeterministicCreatureEpisode,
  runDeterministicEpisode,
} from "../src/index.js";

function expectFiniteResult(
  result: ReturnType<typeof runDeterministicEpisode>,
): void {
  const values = [
    result.aggregateFitness,
    result.elapsedSeconds,
    result.actuationEnergyProxy,
    result.components.forwardProgress,
    result.components.uprightBonus,
    result.components.fallPenalty,
    result.components.actuationEnergyPenalty,
    result.components.lateralDriftPenalty,
    result.components.invalidPenalty,
    result.gait.dutyFactor,
    result.gait.diagonalCoordination,
  ];
  expect(values.every(Number.isFinite)).toBe(true);
  for (const frame of result.frames) {
    for (const body of frame.bodies) {
      expect(
        [
          body.translation.x,
          body.translation.y,
          body.translation.z,
          body.rotation.x,
          body.rotation.y,
          body.rotation.z,
          body.rotation.w,
        ].every(Number.isFinite),
      ).toBe(true);
    }
  }
}

describe("deterministic articulated creature episode", () => {
  it("terminates at the fixed duration with finite component fitness", () => {
    const result = runDeterministicEpisode(createSeededController(7_311));

    expect(result.terminatedAtStep).toBe(720);
    expect(result.elapsedSeconds).toBe(DEFAULT_EPISODE_CONFIG.durationSeconds);
    expect(result.invalidReason).toBeNull();
    expect(result.frames).toHaveLength(61);
    expect(Object.keys(result.components)).toEqual([
      "forwardProgress",
      "uprightBonus",
      "fallPenalty",
      "actuationEnergyPenalty",
      "lateralDriftPenalty",
      "invalidPenalty",
    ]);
    expect(result.gait.dutyFactor).toBeGreaterThanOrEqual(0);
    expect(result.gait.dutyFactor).toBeLessThanOrEqual(1);
    expect(result.gait.diagonalCoordination).toBeGreaterThanOrEqual(0);
    expect(result.gait.diagonalCoordination).toBeLessThanOrEqual(1);
    expect(typeof result.viable).toBe("boolean");
    expectFiniteResult(result);
  });

  it("repeats exactly in the supported runtime", () => {
    const controller = createSeededController(2026);
    const first = runDeterministicEpisode(controller);
    const second = runDeterministicEpisode(controller);

    expect(second.aggregateFitness).toBe(first.aggregateFitness);
    expect(second.components).toEqual(first.components);
    expect(second.finalWorldChecksum).toBe(first.finalWorldChecksum);
    expect(second.frames).toEqual(first.frames);
  });

  it("reset and replay do not leak prior world state", () => {
    const episode = new DeterministicCreatureEpisode(
      createSeededController(99),
    );
    try {
      const first = episode.run();
      expect(() => episode.run()).toThrow(/reset/u);
      const replay = episode.replay();

      expect(replay).toEqual(first);
    } finally {
      episode.dispose();
    }
  });

  it("rejects configurations that cannot terminate on a whole fixed timestep", () => {
    expect(
      () =>
        new DeterministicCreatureEpisode(createSeededController(1), {
          ...DEFAULT_EPISODE_CONFIG,
          durationSeconds: 3.001,
        }),
    ).toThrow(/whole fixed timesteps/u);
  });
});
