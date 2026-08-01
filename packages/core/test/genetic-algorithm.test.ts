import { describe, expect, it } from "vitest";

import {
  CONTROLLER_BOUNDS,
  ControllerEvolutionSession,
  DEFAULT_GA_CONFIG,
  evolveControllerPopulation,
  genomeScalarCount,
  validateControllerGenome,
  validateGeneticAlgorithmConfig,
  type PeriodicControllerGenome,
} from "../src/index.js";

function analyticFitness(genome: PeriodicControllerGenome): number {
  return genome.joints.reduce(
    (sum, joint) =>
      sum -
      Math.abs(joint.amplitude - 0.4) -
      Math.abs(joint.frequencyHz - 1) -
      Math.abs(joint.phaseRadians) * 0.1 -
      Math.abs(joint.offset),
    0,
  );
}

const TEST_CONFIG = {
  seed: 7_311,
  ...DEFAULT_GA_CONFIG,
  populationSize: 10,
  generations: 8,
};

describe("controller genetic algorithm", () => {
  it("repeats the same evolution and preserves elitism", () => {
    const first = evolveControllerPopulation(TEST_CONFIG, analyticFitness);
    const second = evolveControllerPopulation(TEST_CONFIG, analyticFitness);

    expect(second).toEqual(first);
    expect(first.history).toHaveLength(TEST_CONFIG.generations + 1);
    for (let index = 1; index < first.history.length; index += 1) {
      expect(first.history[index]?.bestFitness).toBeGreaterThanOrEqual(
        first.history[index - 1]?.bestFitness ?? Number.NEGATIVE_INFINITY,
      );
    }
  });

  it("advances one generation at a time without changing the result", () => {
    const expected = evolveControllerPopulation(TEST_CONFIG, analyticFitness);
    const session = new ControllerEvolutionSession(
      TEST_CONFIG,
      analyticFitness,
    );

    expect(session.snapshot()).toMatchObject({
      generation: 0,
      complete: false,
    });
    while (!session.snapshot().complete) {
      session.advanceGeneration();
    }

    const snapshot = session.snapshot();
    expect(snapshot.generation).toBe(TEST_CONFIG.generations);
    expect(snapshot.complete).toBe(true);
    expect({
      config: snapshot.config,
      history: snapshot.history,
      champion: snapshot.champion,
      lineage: snapshot.lineage,
    }).toEqual(expected);
    expect(() => session.advanceGeneration()).toThrow(/already complete/u);
  });

  it("keeps every evolved scalar finite and bounded", () => {
    const result = evolveControllerPopulation(TEST_CONFIG, analyticFitness);
    expect(genomeScalarCount()).toBe(16);
    expect(() => {
      validateControllerGenome(result.champion.genome);
    }).not.toThrow();
    for (const joint of result.champion.genome.joints) {
      expect(joint.amplitude).toBeGreaterThanOrEqual(
        CONTROLLER_BOUNDS.amplitude.minimum,
      );
      expect(joint.amplitude).toBeLessThanOrEqual(
        CONTROLLER_BOUNDS.amplitude.maximum,
      );
      expect(joint.frequencyHz).toBeGreaterThanOrEqual(
        CONTROLLER_BOUNDS.frequencyHz.minimum,
      );
      expect(joint.frequencyHz).toBeLessThanOrEqual(
        CONTROLLER_BOUNDS.frequencyHz.maximum,
      );
      expect(joint.phaseRadians).toBeGreaterThanOrEqual(
        CONTROLLER_BOUNDS.phaseRadians.minimum,
      );
      expect(joint.phaseRadians).toBeLessThanOrEqual(
        CONTROLLER_BOUNDS.phaseRadians.maximum,
      );
      expect(joint.offset).toBeGreaterThanOrEqual(
        CONTROLLER_BOUNDS.offset.minimum,
      );
      expect(joint.offset).toBeLessThanOrEqual(
        CONTROLLER_BOUNDS.offset.maximum,
      );
    }
  });

  it("records complete ancestry and bounded diversity telemetry", () => {
    const result = evolveControllerPopulation(TEST_CONFIG, analyticFitness);
    const records = new Map(
      result.lineage.map((record) => [record.id, record]),
    );

    expect(result.lineage).toHaveLength(
      TEST_CONFIG.populationSize * (TEST_CONFIG.generations + 1),
    );
    expect(records.size).toBe(result.lineage.length);
    expect(result.champion.lineageId).toBe(
      result.history.at(-1)?.championLineageId,
    );
    expect(
      result.lineage.filter(({ eliteCarryover }) => eliteCarryover),
    ).toHaveLength(TEST_CONFIG.eliteCount * TEST_CONFIG.generations);

    for (const record of result.lineage) {
      expect(record.parentIds).toHaveLength(
        record.generation === 0 ? 0 : record.eliteCarryover ? 1 : 2,
      );
      for (const parentId of record.parentIds) {
        const parent = records.get(parentId);
        expect(parent).toBeDefined();
        expect(parent?.generation).toBe(record.generation - 1);
      }
    }
    for (const summary of result.history) {
      expect(summary.medianFitness).toBeGreaterThanOrEqual(
        Number.NEGATIVE_INFINITY,
      );
      expect(summary.duplicateRate).toBeGreaterThanOrEqual(0);
      expect(summary.duplicateRate).toBeLessThanOrEqual(1);
      expect(summary.meanGenotypeDistance).toBeGreaterThanOrEqual(0);
      expect(summary.meanGenotypeDistance).toBeLessThanOrEqual(1);
    }
  });

  it("rejects invalid configuration and evaluator output", () => {
    expect(() => {
      validateGeneticAlgorithmConfig({ ...TEST_CONFIG, eliteCount: 10 });
    }).toThrow(/Elite count/u);
    expect(() =>
      evolveControllerPopulation(TEST_CONFIG, () => Number.NaN),
    ).toThrow(/non-finite fitness/u);
  });
});
