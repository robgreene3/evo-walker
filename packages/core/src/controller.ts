import { Mulberry32 } from "./prng.js";

export const ACTUATED_JOINT_COUNT = 4;

export interface JointControllerGenes {
  readonly amplitude: number;
  readonly frequencyHz: number;
  readonly phaseRadians: number;
  readonly offset: number;
}

export interface PeriodicControllerGenome {
  readonly seed: number;
  readonly joints: readonly JointControllerGenes[];
}

export const CONTROLLER_BOUNDS = Object.freeze({
  amplitude: Object.freeze({ minimum: -0.9, maximum: 0.9 }),
  frequencyHz: Object.freeze({ minimum: 0.25, maximum: 2.5 }),
  phaseRadians: Object.freeze({ minimum: -Math.PI, maximum: Math.PI }),
  offset: Object.freeze({ minimum: -0.4, maximum: 0.4 }),
  targetRadians: Object.freeze({ minimum: -1, maximum: 1 }),
});

const TAU = 2 * Math.PI;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function wrapPhase(value: number): number {
  return ((((value + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

function assertBounded(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(
      `${label} must be finite and within [${minimum}, ${maximum}].`,
    );
  }
}

export function validateControllerGenome(
  genome: PeriodicControllerGenome,
): void {
  if (!Number.isSafeInteger(genome.seed)) {
    throw new TypeError("Controller seed must be a safe integer.");
  }
  if (genome.joints.length !== ACTUATED_JOINT_COUNT) {
    throw new RangeError(
      `Controller must contain exactly ${ACTUATED_JOINT_COUNT} joints.`,
    );
  }
  genome.joints.forEach((joint, index) => {
    assertBounded(
      joint.amplitude,
      CONTROLLER_BOUNDS.amplitude.minimum,
      CONTROLLER_BOUNDS.amplitude.maximum,
      `Joint ${index} amplitude`,
    );
    assertBounded(
      joint.frequencyHz,
      CONTROLLER_BOUNDS.frequencyHz.minimum,
      CONTROLLER_BOUNDS.frequencyHz.maximum,
      `Joint ${index} frequency`,
    );
    assertBounded(
      joint.phaseRadians,
      CONTROLLER_BOUNDS.phaseRadians.minimum,
      CONTROLLER_BOUNDS.phaseRadians.maximum,
      `Joint ${index} phase`,
    );
    assertBounded(
      joint.offset,
      CONTROLLER_BOUNDS.offset.minimum,
      CONTROLLER_BOUNDS.offset.maximum,
      `Joint ${index} offset`,
    );
  });
}

export function createSeededController(seed: number): PeriodicControllerGenome {
  const prng = new Mulberry32(seed);
  const baseFrequency = prng.range(0.75, 1.25);
  const gaitPhase = prng.range(-0.2, 0.2);
  const phasePattern = [
    gaitPhase,
    gaitPhase + Math.PI,
    gaitPhase + Math.PI / 2,
    gaitPhase - Math.PI / 2,
  ] as const;
  const joints = Array.from({ length: ACTUATED_JOINT_COUNT }, (_, index) => {
    const isKnee = index >= 2;
    return {
      amplitude: isKnee ? prng.range(0.45, 0.9) : prng.range(0.25, 0.7),
      frequencyHz: clamp(
        baseFrequency + prng.range(-0.04, 0.04),
        CONTROLLER_BOUNDS.frequencyHz.minimum,
        CONTROLLER_BOUNDS.frequencyHz.maximum,
      ),
      phaseRadians: wrapPhase(
        (phasePattern[index] ?? 0) + prng.range(-0.12, 0.12),
      ),
      offset: isKnee ? prng.range(-0.25, -0.05) : prng.range(-0.06, 0.06),
    };
  });
  const genome = { seed, joints };
  validateControllerGenome(genome);
  return genome;
}

export function controllerTargetsAt(
  genome: PeriodicControllerGenome,
  elapsedSeconds: number,
): readonly number[] {
  validateControllerGenome(genome);
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new RangeError(
      "Controller time must be a finite non-negative number.",
    );
  }
  return genome.joints.map((joint) =>
    clamp(
      joint.offset +
        joint.amplitude *
          Math.sin(
            TAU * joint.frequencyHz * elapsedSeconds + joint.phaseRadians,
          ),
      CONTROLLER_BOUNDS.targetRadians.minimum,
      CONTROLLER_BOUNDS.targetRadians.maximum,
    ),
  );
}
