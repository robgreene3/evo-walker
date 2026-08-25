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
    expect(restored.schemaVersion).toBe(4);
    expect(restored.snapshot.config.episodeDurationSeconds).toBe(6);
    expect(restored.snapshot.config.terrain.kind).toBe("flat");
    expect(restored.championEpisode?.viable).toBe(true);
    expect(Object.isFrozen(restored.snapshot.archive)).toBe(true);
  });

  it("round-trips a thirty-second checkpoint before a champion exists", () => {
    const session = new QualityDiversitySession(
      {
        seed: 42,
        ...DEFAULT_QUALITY_DIVERSITY_CONFIG,
        initialPopulation: 4,
        archiveBins: 4,
        episodeDurationSeconds: 30,
      },
      () => ({
        fitness: 0,
        behavior: { dutyFactor: 0.5, diagonalCoordination: 0.5 },
        viable: false,
      }),
    );
    const document = createQualityDiversityExperimentDocument(
      session.snapshot(),
      null,
    );
    const restored = parseQualityDiversityExperimentJson(
      serializeQualityDiversityExperimentDocument(document),
    );

    expect(restored.physics.durationSeconds).toBe(30);
    expect(restored.snapshot.config.episodeDurationSeconds).toBe(30);
    expect(restored.championEpisode).toBeNull();
  });

  it("rejects old, inconsistent, and oversized input", () => {
    const document = benchmarkDocument();
    const inconsistent = JSON.parse(
      serializeQualityDiversityExperimentDocument(document),
    ) as { championEpisode: { aggregateFitness: number } };
    inconsistent.championEpisode.aggregateFitness += 1;
    const inconsistentTerrain = JSON.parse(
      serializeQualityDiversityExperimentDocument(document),
    ) as { championEpisode: { terrain: { obstaclesCleared: number } } };
    inconsistentTerrain.championEpisode.terrain.obstaclesCleared = 1;
    const inconsistentDuration = JSON.parse(
      serializeQualityDiversityExperimentDocument(document),
    ) as { snapshot: { config: { episodeDurationSeconds: number } } };
    inconsistentDuration.snapshot.config.episodeDurationSeconds = 30;

    expect(() =>
      parseQualityDiversityExperimentJson('{"schemaVersion":1}'),
    ).toThrow(/requires version 4/u);
    expect(() =>
      parseQualityDiversityExperimentJson('{"schemaVersion":2}'),
    ).toThrow(/migration validation failed/u);
    expect(() =>
      parseQualityDiversityExperimentJson(JSON.stringify(inconsistent)),
    ).toThrow(/fitness does not match/u);
    expect(() =>
      parseQualityDiversityExperimentJson(JSON.stringify(inconsistentTerrain)),
    ).toThrow(/terrain outcome does not match/iu);
    expect(() =>
      parseQualityDiversityExperimentJson(JSON.stringify(inconsistentDuration)),
    ).toThrow(/episode duration does not match/iu);
    expect(() =>
      parseQualityDiversityExperimentJson(
        " ".repeat(MAX_QUALITY_DIVERSITY_EXPERIMENT_BYTES + 1),
      ),
    ).toThrow(/byte limit/u);
  });

  it("migrates valid schema-v2 and schema-v3 experiments without inference", () => {
    const current = benchmarkDocument();
    const legacyV2 = structuredClone(current) as unknown as {
      schemaVersion: number;
      physics: { terrain?: unknown };
      snapshot: {
        config: { terrain?: unknown; episodeDurationSeconds?: unknown };
      };
      championEpisode: null | {
        provenance: { terrain?: unknown };
        terrain?: unknown;
      };
    };
    legacyV2.schemaVersion = 2;
    delete legacyV2.physics.terrain;
    delete legacyV2.snapshot.config.terrain;
    delete legacyV2.snapshot.config.episodeDurationSeconds;
    if (legacyV2.championEpisode !== null) {
      delete legacyV2.championEpisode.provenance.terrain;
      delete legacyV2.championEpisode.terrain;
    }

    const migratedV2 = parseQualityDiversityExperimentJson(
      JSON.stringify(legacyV2),
    );
    const legacyV3 = structuredClone(current) as unknown as {
      schemaVersion: number;
      snapshot: { config: { episodeDurationSeconds?: unknown } };
    };
    legacyV3.schemaVersion = 3;
    delete legacyV3.snapshot.config.episodeDurationSeconds;
    const migratedV3 = parseQualityDiversityExperimentJson(
      JSON.stringify(legacyV3),
    );

    expect(migratedV2.schemaVersion).toBe(4);
    expect(migratedV2.snapshot.config.terrain.kind).toBe("flat");
    expect(migratedV2.snapshot.config.episodeDurationSeconds).toBe(6);
    expect(migratedV2.championEpisode?.terrain.obstaclesTotal).toBe(0);
    expect(migratedV3.schemaVersion).toBe(4);
    expect(migratedV3.snapshot.config.episodeDurationSeconds).toBe(6);
  });
});
