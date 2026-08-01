import { createSeededController } from "@evowalker/core";
import { describe, expect, it } from "vitest";

import { runDeterministicEpisode } from "../src/index.js";

const CANONICAL_EPISODE_SEEDS = [7, 42, 99, 2_026, 7_311] as const;

describe("single-episode reproducibility benchmark", () => {
  it("repeats all canonical seeds without metric or snapshot drift", () => {
    const startedAt = performance.now();
    const outcomes = CANONICAL_EPISODE_SEEDS.map((seed) => {
      const controller = createSeededController(seed);
      const first = runDeterministicEpisode(controller);
      const second = runDeterministicEpisode(controller);
      expect(second.aggregateFitness).toBe(first.aggregateFitness);
      expect(second.components).toEqual(first.components);
      expect(second.finalWorldChecksum).toBe(first.finalWorldChecksum);
      expect(first.invalidReason).toBeNull();
      return {
        seed,
        fitness: first.aggregateFitness,
        checksum: first.finalWorldChecksum,
      };
    });
    const wallTimeMs = performance.now() - startedAt;

    console.info(JSON.stringify({ outcomes, wallTimeMs }));
  });
});
