import {
  DEFAULT_QUALITY_DIVERSITY_CONFIG,
  MAX_QUALITY_DIVERSITY_EXPERIMENT_BYTES,
  QualityDiversitySession,
  createQualityDiversityExperimentDocument,
  parseQualityDiversityExperimentJson,
  serializeQualityDiversityExperimentDocument,
} from "@evowalker/core";
import { describe, expect, it } from "vitest";

import { runDeterministicEpisode } from "../src/index.js";

function benchmarkDocument() {
  const episodes = new Map<
    number,
    ReturnType<typeof runDeterministicEpisode>
  >();
  const session = new QualityDiversitySession(
    {
      seed: 42,
      ...DEFAULT_QUALITY_DIVERSITY_CONFIG,
      initialPopulation: 4,
      archiveBins: 4,
    },
    (genome) => {
      const episode = runDeterministicEpisode(genome);
      episodes.set(genome.seed, episode);
      return {
        fitness: episode.aggregateFitness,
        behavior: episode.gait,
        viable: episode.viable,
      };
    },
  );
  for (let index = 0; index < 4; index += 1) session.advance();
  const snapshot = session.snapshot();
  const champion = snapshot.champion;
  if (champion === null)
    throw new Error("Benchmark did not produce a champion.");
  return createQualityDiversityExperimentDocument(
    snapshot,
    episodes.get(champion.genome.seed) ??
      runDeterministicEpisode(champion.genome),
  );
}

describe("quality-diversity experiment persistence", () => {
  it("round-trips a deterministic checkpoint exactly", () => {
    const document = benchmarkDocument();
    const restored = parseQualityDiversityExperimentJson(
      serializeQualityDiversityExperimentDocument(document),
    );

    expect(restored).toEqual(document);
    expect(restored.schemaVersion).toBe(2);
    expect(restored.championEpisode?.viable).toBe(true);
    expect(Object.isFrozen(restored.snapshot.archive)).toBe(true);
  });

  it("rejects old, inconsistent, and oversized input", () => {
    const document = benchmarkDocument();
    const inconsistent = JSON.parse(
      serializeQualityDiversityExperimentDocument(document),
    ) as { championEpisode: { aggregateFitness: number } };
    inconsistent.championEpisode.aggregateFitness += 1;

    expect(() =>
      parseQualityDiversityExperimentJson('{"schemaVersion":1}'),
    ).toThrow(/requires version 2/u);
    expect(() =>
      parseQualityDiversityExperimentJson(JSON.stringify(inconsistent)),
    ).toThrow(/fitness does not match/u);
    expect(() =>
      parseQualityDiversityExperimentJson(
        " ".repeat(MAX_QUALITY_DIVERSITY_EXPERIMENT_BYTES + 1),
      ),
    ).toThrow(/byte limit/u);
  });
});
