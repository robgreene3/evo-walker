import {
  CONTROLLER_BOUNDS,
  DEFAULT_QUALITY_DIVERSITY_CONFIG,
  QualityDiversitySession,
  type PeriodicControllerGenome,
  type QualityDiversityConfig,
  type QualityDiversityEvaluation,
} from "../src/index.js";
import { describe, expect, it } from "vitest";

const CONFIG: QualityDiversityConfig = {
  ...DEFAULT_QUALITY_DIVERSITY_CONFIG,
  seed: 42,
  initialPopulation: 8,
  archiveBins: 4,
};

function analyticEvaluation(
  genome: PeriodicControllerGenome,
): QualityDiversityEvaluation {
  const meanAmplitude =
    genome.joints.reduce((sum, joint) => sum + Math.abs(joint.amplitude), 0) /
    genome.joints.length;
  const meanFrequency =
    genome.joints.reduce((sum, joint) => sum + joint.frequencyHz, 0) /
    genome.joints.length;
  return {
    fitness: 2 - Math.abs(meanAmplitude - 0.5),
    viable: meanFrequency < 2,
    behavior: {
      dutyFactor: Math.min(1, meanAmplitude),
      diagonalCoordination: Math.min(1, meanFrequency / 2.5),
    },
  };
}

describe("continuous quality-diversity archive", () => {
  it("is deterministic and only admits viable bounded controllers", () => {
    const first = new QualityDiversitySession(CONFIG, analyticEvaluation);
    const second = new QualityDiversitySession(CONFIG, analyticEvaluation);
    for (let index = 0; index < 64; index += 1) {
      first.advance();
      second.advance();
    }

    expect(first.snapshot()).toEqual(second.snapshot());
    expect(first.snapshot().archive.length).toBeGreaterThan(0);
    for (const entry of first.snapshot().archive) {
      expect(entry.behavior.dutyFactor).toBeGreaterThanOrEqual(0);
      expect(entry.behavior.dutyFactor).toBeLessThanOrEqual(1);
      for (const joint of entry.genome.joints) {
        expect(joint.amplitude).toBeGreaterThanOrEqual(
          CONTROLLER_BOUNDS.amplitude.minimum,
        );
        expect(joint.amplitude).toBeLessThanOrEqual(
          CONTROLLER_BOUNDS.amplitude.maximum,
        );
      }
    }
  });

  it("resumes exactly from a deterministic checkpoint", () => {
    const uninterrupted = new QualityDiversitySession(
      CONFIG,
      analyticEvaluation,
    );
    for (let index = 0; index < 40; index += 1) uninterrupted.advance();

    const staged = new QualityDiversitySession(CONFIG, analyticEvaluation);
    for (let index = 0; index < 17; index += 1) staged.advance();
    const resumed = new QualityDiversitySession(
      CONFIG,
      analyticEvaluation,
      staged.snapshot(),
    );
    for (let index = 17; index < 40; index += 1) resumed.advance();

    expect(resumed.snapshot()).toEqual(uninterrupted.snapshot());
  });

  it("rejects non-finite or out-of-range evaluator output", () => {
    expect(
      () =>
        new QualityDiversitySession(CONFIG, () => ({
          fitness: Number.NaN,
          viable: true,
          behavior: { dutyFactor: 0.5, diagonalCoordination: 0.5 },
        })),
    ).toThrow(/non-finite/u);
    expect(
      () =>
        new QualityDiversitySession(CONFIG, () => ({
          fitness: 1,
          viable: true,
          behavior: { dutyFactor: 2, diagonalCoordination: 0.5 },
        })),
    ).toThrow(/within \[0, 1\]/u);
  });
});
