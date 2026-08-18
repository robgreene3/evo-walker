import {
  DEFAULT_QUALITY_DIVERSITY_CONFIG,
  QualityDiversitySession,
  createSeededController,
} from "@evowalker/core";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_EPISODE_CONFIG,
  runDeterministicEpisode,
} from "../src/index.js";

const PROBE_SEEDS = [7, 42, 99, 2_026, 7_311] as const;
const ENDURANCE_DURATION_SECONDS = 30;
const ENDURANCE_SEARCH_ADVANCES = 96;

describe("episode-duration experiment", () => {
  it("compares the verified six-second baseline with deterministic endurance trials", () => {
    const outcomes = PROBE_SEEDS.map((seed) => {
      const controller = createSeededController(seed);
      const baselineStartedAt = performance.now();
      const baseline = runDeterministicEpisode(controller);
      const baselineWallTimeMs = performance.now() - baselineStartedAt;
      const enduranceConfig = {
        ...DEFAULT_EPISODE_CONFIG,
        durationSeconds: ENDURANCE_DURATION_SECONDS,
      };
      const enduranceStartedAt = performance.now();
      const endurance = runDeterministicEpisode(controller, enduranceConfig);
      const enduranceWallTimeMs = performance.now() - enduranceStartedAt;
      const replay = runDeterministicEpisode(controller, enduranceConfig);

      expect(replay).toEqual(endurance);
      expect(endurance.invalidReason).toBeNull();
      expect(Number.isFinite(endurance.aggregateFitness)).toBe(true);

      return {
        seed,
        baselineViable: baseline.viable,
        enduranceViable: endurance.viable,
        enduranceSeconds: endurance.elapsedSeconds,
        baselineProgress: Number(
          baseline.components.forwardProgress.toFixed(4),
        ),
        enduranceProgress: Number(
          endurance.components.forwardProgress.toFixed(4),
        ),
        baselineWallTimeMs: Number(baselineWallTimeMs.toFixed(1)),
        enduranceWallTimeMs: Number(enduranceWallTimeMs.toFixed(1)),
      };
    });

    console.table(outcomes);
  }, 60_000);

  it("finds a viable endurance controller within a bounded interactive budget", () => {
    const episodeConfig = {
      ...DEFAULT_EPISODE_CONFIG,
      durationSeconds: ENDURANCE_DURATION_SECONDS,
    };
    const startedAt = performance.now();
    const session = new QualityDiversitySession(
      { seed: 42, ...DEFAULT_QUALITY_DIVERSITY_CONFIG },
      (genome) => {
        const episode = runDeterministicEpisode(genome, episodeConfig);
        return {
          fitness: episode.aggregateFitness,
          behavior: episode.gait,
          viable: episode.viable,
        };
      },
    );
    for (let index = 0; index < ENDURANCE_SEARCH_ADVANCES; index += 1) {
      session.advance();
    }
    const snapshot = session.snapshot();
    const champion = snapshot.champion;
    expect(champion).not.toBeNull();
    if (champion === null) return;
    const episode = runDeterministicEpisode(champion.genome, episodeConfig);
    const replay = runDeterministicEpisode(champion.genome, episodeConfig);

    expect(episode.viable).toBe(true);
    expect(episode.elapsedSeconds).toBe(ENDURANCE_DURATION_SECONDS);
    expect(episode.components.forwardProgress).toBeGreaterThanOrEqual(0.25);
    expect(replay).toEqual(episode);
    console.info(
      JSON.stringify({
        durationSeconds: ENDURANCE_DURATION_SECONDS,
        evaluations: snapshot.evaluations,
        archiveSize: snapshot.archive.length,
        fitness: episode.aggregateFitness,
        forwardProgress: episode.components.forwardProgress,
        checksum: episode.finalWorldChecksum,
        wallTimeMs: performance.now() - startedAt,
      }),
    );
  }, 90_000);
});
