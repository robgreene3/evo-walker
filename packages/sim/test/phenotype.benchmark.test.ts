import {
  CONTROLLER_BOUNDS,
  Mulberry32,
  validateControllerGenome,
  type PeriodicControllerGenome,
} from "@evowalker/core";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_EPISODE_CONFIG,
  runDeterministicEpisode,
} from "../src/index.js";

const PROBE_SIZE = 64;
const TAU = 2 * Math.PI;

function wrapPhase(value: number): number {
  return ((((value + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

function createProbeController(index: number): PeriodicControllerGenome {
  const seed = 0x4556_4f00 + index;
  if (index === 0) {
    return {
      seed,
      joints: Array.from({ length: 4 }, () => ({
        amplitude: 0,
        frequencyHz: 1,
        phaseRadians: 0,
        offset: 0,
      })),
    };
  }
  const prng = new Mulberry32(seed);
  const frequencyHz = prng.range(0.7, 1.45);
  const gaitPhase = prng.range(-Math.PI, Math.PI);
  const hipAmplitude = prng.range(0.05, 0.7);
  const kneeAmplitude = prng.range(0.1, 0.8);
  const kneeLag = prng.range(0.25, 1.5);
  const hipOffset = prng.range(-0.08, 0.08);
  const kneeOffset = prng.range(-0.3, -0.02);
  const asymmetry = prng.range(0.9, 1.1);
  const genome: PeriodicControllerGenome = {
    seed,
    joints: [
      {
        amplitude: hipAmplitude,
        frequencyHz,
        phaseRadians: gaitPhase,
        offset: hipOffset,
      },
      {
        amplitude: Math.min(
          CONTROLLER_BOUNDS.amplitude.maximum,
          hipAmplitude * asymmetry,
        ),
        frequencyHz,
        phaseRadians: wrapPhase(gaitPhase + Math.PI),
        offset: -hipOffset,
      },
      {
        amplitude: kneeAmplitude,
        frequencyHz,
        phaseRadians: wrapPhase(gaitPhase + kneeLag),
        offset: kneeOffset,
      },
      {
        amplitude: Math.min(
          CONTROLLER_BOUNDS.amplitude.maximum,
          kneeAmplitude / asymmetry,
        ),
        frequencyHz,
        phaseRadians: wrapPhase(gaitPhase + Math.PI + kneeLag),
        offset: kneeOffset,
      },
    ],
  };
  validateControllerGenome(genome);
  return genome;
}

describe("fixed-phenotype locomotion gate", () => {
  it("produces a material deterministic forward-displacement envelope", () => {
    const outcomes = Array.from({ length: PROBE_SIZE }, (_, index) => {
      const result = runDeterministicEpisode(createProbeController(index));
      expect(result.invalidReason).toBeNull();
      const settlingStep =
        DEFAULT_EPISODE_CONFIG.settlingSeconds /
        DEFAULT_EPISODE_CONFIG.timestepSeconds;
      const settledFrame = result.frames.find(
        (frame) => frame.step === settlingStep,
      );
      const finalFrame = result.frames.at(-1);
      if (settledFrame === undefined || finalFrame === undefined) {
        throw new Error("Episode did not capture settled and final frames.");
      }
      const footAdvance = ["left-lower-leg", "right-lower-leg"].map((id) => {
        const settledBody = settledFrame.bodies.find((body) => body.id === id);
        const finalBody = finalFrame.bodies.find((body) => body.id === id);
        if (settledBody === undefined || finalBody === undefined) {
          throw new Error(`Episode did not capture ${id}.`);
        }
        return finalBody.translation.x - settledBody.translation.x;
      });
      return {
        index,
        forwardProgress: result.components.forwardProgress,
        aggregateFitness: result.aggregateFitness,
        fallPenalty: result.components.fallPenalty,
        maximumFootAdvance: Math.max(...footAdvance),
        checksum: result.finalWorldChecksum,
      };
    });
    const stableOutcomes = outcomes.filter(
      (outcome) => outcome.fallPenalty === 0,
    );
    const passiveControl = outcomes[0];
    if (passiveControl === undefined) {
      throw new Error("Probe did not include its passive control.");
    }
    expect(stableOutcomes.length).toBeGreaterThan(0);
    const progress = stableOutcomes.map((outcome) => outcome.forwardProgress);
    const minimum = Math.min(...progress);
    const maximum = Math.max(...progress);
    const champion = stableOutcomes.reduce((best, outcome) =>
      outcome.forwardProgress > best.forwardProgress ? outcome : best,
    );
    const replay = runDeterministicEpisode(
      createProbeController(champion.index),
    );
    const bodyRanges = replay.frames[0]?.bodies.map(({ id }) => {
      const translations = replay.frames.flatMap((frame) =>
        frame.bodies
          .filter((body) => body.id === id)
          .map((body) => body.translation),
      );
      return {
        id,
        minimumX: Math.min(...translations.map(({ x }) => x)),
        maximumX: Math.max(...translations.map(({ x }) => x)),
        minimumY: Math.min(...translations.map(({ y }) => y)),
        maximumY: Math.max(...translations.map(({ y }) => y)),
      };
    });

    console.info(
      JSON.stringify({
        probeSize: PROBE_SIZE,
        stableCount: stableOutcomes.length,
        stableOutcomes,
        minimum,
        maximum,
        range: maximum - minimum,
        champion,
        bodyRanges,
      }),
    );
    expect(replay.components.forwardProgress).toBe(champion.forwardProgress);
    expect(replay.components.fallPenalty).toBe(0);
    expect(replay.finalWorldChecksum).toBe(champion.checksum);
    expect(champion.maximumFootAdvance).toBeGreaterThanOrEqual(0.02);
    expect(Math.abs(passiveControl.forwardProgress)).toBeLessThanOrEqual(0.005);
    expect(maximum).toBeGreaterThanOrEqual(0.02);
    expect(maximum - minimum).toBeGreaterThanOrEqual(0.04);
  });
});
