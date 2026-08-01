import {
  ControllerEvolutionSession,
  DEFAULT_GA_CONFIG,
  EXPERIMENT_BUILD_VERSION,
  MAX_EXPERIMENT_BYTES,
  createExperimentDocument,
  parseExperimentJson,
  serializeExperimentDocument,
} from "@evowalker/core";
import { describe, expect, it } from "vitest";

import { runDeterministicEpisode } from "../src/index.js";

function benchmarkDocument() {
  const session = new ControllerEvolutionSession(
    {
      seed: 42,
      ...DEFAULT_GA_CONFIG,
      populationSize: 4,
      generations: 1,
      eliteCount: 1,
      tournamentSize: 2,
    },
    (genome) => runDeterministicEpisode(genome).aggregateFitness,
  );
  session.complete();
  const snapshot = session.snapshot();
  return createExperimentDocument(
    snapshot,
    runDeterministicEpisode(snapshot.champion.genome),
  );
}

describe("experiment persistence", () => {
  it("round-trips an immutable benchmark experiment exactly", () => {
    const document = benchmarkDocument();
    const serialized = serializeExperimentDocument(document);
    const restored = parseExperimentJson(serialized);

    expect(restored).toEqual(document);
    expect(restored.buildVersion).toBe(EXPERIMENT_BUILD_VERSION);
    expect(restored.championEpisode.finalWorldChecksum).toBe(
      document.championEpisode.finalWorldChecksum,
    );
    expect(Object.isFrozen(restored)).toBe(true);
    expect(Object.isFrozen(restored.snapshot.lineage)).toBe(true);
  });

  it("rejects corrupt, inconsistent, unsupported, and oversized inputs", () => {
    const document = benchmarkDocument();
    const inconsistent = JSON.parse(serializeExperimentDocument(document)) as {
      championEpisode: { aggregateFitness: number };
    };
    inconsistent.championEpisode.aggregateFitness += 1;

    expect(() => parseExperimentJson("not json")).toThrow(/not valid JSON/u);
    expect(() => parseExperimentJson('{"schemaVersion":99}')).toThrow(
      /Unsupported experiment schema version/u,
    );
    expect(() => parseExperimentJson(JSON.stringify(inconsistent))).toThrow(
      /fitness does not match/u,
    );
    expect(() =>
      parseExperimentJson(" ".repeat(MAX_EXPERIMENT_BYTES + 1)),
    ).toThrow(/byte limit/u);
  });
});
