import {
  createSeededController,
  type PeriodicControllerGenome,
} from "@evowalker/core";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_EPISODE_CONFIG,
  runDeterministicEpisode,
} from "../src/index.js";

const PROBE_SIZE = 64;
function createProbeController(index: number): PeriodicControllerGenome {
  const seed = 0x4556_4f00 + index;
  if (index === 0) {
    return {
      seed,
      joints: Array.from({ length: 8 }, () => ({
        amplitude: 0,
        frequencyHz: 1,
        phaseRadians: 0,
        offset: 0,
      })),
    };
  }
  return createSeededController(seed);
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
        (frame) => frame.step >= settlingStep,
      );
      const finalFrame = result.frames.at(-1);
      if (settledFrame === undefined || finalFrame === undefined) {
        throw new Error("Episode did not capture settled and final frames.");
      }
      const footAdvance = [
        "front-left-lower-leg",
        "front-right-lower-leg",
        "rear-left-lower-leg",
        "rear-right-lower-leg",
      ].map((id) => {
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
