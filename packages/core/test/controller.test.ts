import { describe, expect, it } from "vitest";

import {
  ACTUATED_JOINT_COUNT,
  CONTROLLER_BOUNDS,
  controllerTargetsAt,
  createSeededController,
  validateControllerGenome,
} from "../src/index.js";

describe("periodic controller", () => {
  it("creates the same bounded genome from the same seed", () => {
    const first = createSeededController(7_311);
    const second = createSeededController(7_311);

    expect(first).toEqual(second);
    expect(first.joints).toHaveLength(ACTUATED_JOINT_COUNT);
    expect(() => {
      validateControllerGenome(first);
    }).not.toThrow();
  });

  it("produces finite targets inside every joint limit", () => {
    const genome = createSeededController(42);
    for (let step = 0; step < 1_000; step += 1) {
      const targets = controllerTargetsAt(genome, step / 120);
      for (const target of targets) {
        expect(Number.isFinite(target)).toBe(true);
        expect(target).toBeGreaterThanOrEqual(
          CONTROLLER_BOUNDS.targetRadians.minimum,
        );
        expect(target).toBeLessThanOrEqual(
          CONTROLLER_BOUNDS.targetRadians.maximum,
        );
      }
    }
  });

  it("rejects invalid values at the boundary", () => {
    const genome = createSeededController(19);
    const [firstJoint, ...remainingJoints] = genome.joints;
    if (firstJoint === undefined) {
      throw new Error(
        "Seeded controller did not contain its required first joint.",
      );
    }
    const invalid = {
      ...genome,
      joints: [{ ...firstJoint, amplitude: Number.NaN }, ...remainingJoints],
    };

    expect(() => {
      validateControllerGenome(invalid);
    }).toThrow(/amplitude/u);
  });
});
