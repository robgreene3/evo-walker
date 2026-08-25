import {
  DEFAULT_QUALITY_DIVERSITY_CONFIG,
  QualityDiversitySession,
} from "@evowalker/core";
import { describe, expect, it } from "vitest";

import { runDeterministicEpisode } from "../src/index.js";

const EVOLUTION_SEEDS = [7, 42, 99] as const;
const OFFSPRING_EVALUATIONS = 128;

describe("continuous controller quality-diversity gate", () => {
  it("expands the viable gait archive and improves the canonical seed set", () => {
    const startedAt = performance.now();
    const runs = EVOLUTION_SEEDS.map((seed) => {
      const session = new QualityDiversitySession(
        {
          seed,
          ...DEFAULT_QUALITY_DIVERSITY_CONFIG,
          initialPopulation: 24,
          archiveBins: 8,
        },
        (genome) => {
          const episode = runDeterministicEpisode(genome);
          return {
            fitness: episode.aggregateFitness,
            behavior: episode.gait,
            viable: episode.viable,
          };
        },
      );
      const initial = session.snapshot();
      for (let index = 0; index < OFFSPRING_EVALUATIONS; index += 1) {
        session.advance();
      }
      const final = session.snapshot();
      if (initial.champion === null || final.champion === null) {
        throw new Error(
          "Canonical exploration did not produce a viable champion.",
        );
      }
      const episode = runDeterministicEpisode(final.champion.genome);
      const improvement = final.champion.fitness - initial.champion.fitness;

      expect(final.evaluations).toBe(24 + OFFSPRING_EVALUATIONS);
      expect(
        final.archive.length - initial.archive.length,
      ).toBeGreaterThanOrEqual(6);
      expect(improvement).toBeGreaterThanOrEqual(0);
      expect(episode.components.forwardProgress).toBeGreaterThanOrEqual(0.1);
      expect(episode.viable).toBe(true);
      expect(episode.components.fallPenalty).toBe(0);
      expect(episode.invalidReason).toBeNull();
      expect(episode.aggregateFitness).toBe(final.champion.fitness);
      return {
        seed,
        initialBest: initial.champion.fitness,
        finalBest: final.champion.fitness,
        improvement,
        initialArchiveSize: initial.archive.length,
        finalArchiveSize: final.archive.length,
        forwardProgress: episode.components.forwardProgress,
        checksum: episode.finalWorldChecksum,
      };
    });

    const improvements = runs.map(({ improvement }) => improvement);
    expect(improvements.filter((value) => value >= 0.1)).toHaveLength(2);
    expect(
      improvements.reduce((sum, value) => sum + value, 0) / improvements.length,
    ).toBeGreaterThanOrEqual(0.4);
    console.info(
      JSON.stringify({
        founders: 24,
        offspringEvaluations: OFFSPRING_EVALUATIONS,
        archiveBins: 8,
        outcomes: runs,
        wallTimeMs: performance.now() - startedAt,
      }),
    );
  }, 90_000);
});
