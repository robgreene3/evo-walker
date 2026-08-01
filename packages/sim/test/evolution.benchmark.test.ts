import { DEFAULT_GA_CONFIG, evolveControllerPopulation } from "@evowalker/core";
import { describe, expect, it } from "vitest";

import { runDeterministicEpisode } from "../src/index.js";

const EVOLUTION_SEEDS = [7, 42, 99] as const;

function evolve(seed: number) {
  return evolveControllerPopulation(
    { seed, ...DEFAULT_GA_CONFIG },
    (genome) => runDeterministicEpisode(genome).aggregateFitness,
  );
}

describe("30-generation controller evolution gate", () => {
  it("improves across canonical seeds without a fall or standing-still exploit", () => {
    const startedAt = performance.now();
    const runs = EVOLUTION_SEEDS.map((seed) => {
      const evolution = evolve(seed);
      const initial = evolution.history[0];
      if (initial === undefined) {
        throw new Error("Evolution did not record its initial generation.");
      }
      const episode = runDeterministicEpisode(evolution.champion.genome);
      const improvement = evolution.champion.fitness - initial.bestFitness;

      expect(evolution.history).toHaveLength(DEFAULT_GA_CONFIG.generations + 1);
      expect(improvement).toBeGreaterThanOrEqual(0.02);
      expect(episode.components.forwardProgress).toBeGreaterThanOrEqual(0.02);
      expect(episode.components.fallPenalty).toBe(0);
      expect(episode.invalidReason).toBeNull();
      expect(episode.aggregateFitness).toBe(evolution.champion.fitness);
      return {
        seed,
        initialBest: initial.bestFitness,
        finalBest: evolution.champion.fitness,
        improvement,
        forwardProgress: episode.components.forwardProgress,
        checksum: episode.finalWorldChecksum,
        evolution,
      };
    });

    expect(evolve(EVOLUTION_SEEDS[0])).toEqual(runs[0]?.evolution);
    console.info(
      JSON.stringify({
        populationSize: DEFAULT_GA_CONFIG.populationSize,
        generations: DEFAULT_GA_CONFIG.generations,
        outcomes: runs.map((run) => ({
          seed: run.seed,
          initialBest: run.initialBest,
          finalBest: run.finalBest,
          improvement: run.improvement,
          forwardProgress: run.forwardProgress,
          checksum: run.checksum,
        })),
        wallTimeMs: performance.now() - startedAt,
      }),
    );
  }, 90_000);
});
