import { describe, expect, it } from "vitest";

import {
  CONTROLLER_BOUNDS,
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

  it("rejects invalid configuration and evaluator output", () => {
    expect(() => {
      validateGeneticAlgorithmConfig({ ...TEST_CONFIG, eliteCount: 10 });
    }).toThrow(/Elite count/u);
    expect(() =>
      evolveControllerPopulation(TEST_CONFIG, () => Number.NaN),
    ).toThrow(/non-finite fitness/u);
  });
});
