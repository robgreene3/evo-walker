import RAPIER from "@dimforge/rapier3d-deterministic-compat";
import {
  ACTUATED_JOINT_COUNT,
  controllerTargetsAt,
  validateControllerGenome,
  type PeriodicControllerGenome,
} from "@evowalker/core";

await RAPIER.init();

export const RAPIER_BINDING_VERSION = "0.19.3" as const;
export const EPISODE_SCHEMA_VERSION = 1 as const;

export interface EpisodeConfig {
  readonly timestepSeconds: number;
  readonly substeps: number;
  readonly durationSeconds: number;
  readonly settlingSeconds: number;
  readonly snapshotEverySteps: number;
}

export const DEFAULT_EPISODE_CONFIG: EpisodeConfig = Object.freeze({
  timestepSeconds: 1 / 120,
  substeps: 1,
  durationSeconds: 6,
  settlingSeconds: 0.75,
  snapshotEverySteps: 12,
});

export interface VectorSnapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface RotationSnapshot extends VectorSnapshot {
  readonly w: number;
}

export interface BodySnapshot {
  readonly id: string;
  readonly translation: VectorSnapshot;
  readonly rotation: RotationSnapshot;
}

export interface EpisodeFrame {
  readonly step: number;
  readonly elapsedSeconds: number;
  readonly bodies: readonly BodySnapshot[];
}

export interface FitnessComponents {
  readonly forwardProgress: number;
  readonly uprightBonus: number;
  readonly fallPenalty: number;
  readonly actuationEnergyPenalty: number;
  readonly lateralDriftPenalty: number;
  readonly invalidPenalty: number;
}

export interface GaitDescriptor {
  readonly dutyFactor: number;
  readonly diagonalCoordination: number;
}

export interface EpisodeProvenance {
  readonly schemaVersion: typeof EPISODE_SCHEMA_VERSION;
  readonly rapierBindingVersion: typeof RAPIER_BINDING_VERSION;
  readonly rapierEngineVersion: string;
  readonly seed: number;
  readonly timestepSeconds: number;
  readonly substeps: number;
}

export interface EpisodeResult {
  readonly provenance: EpisodeProvenance;
  readonly terminatedAtStep: number;
  readonly elapsedSeconds: number;
  readonly aggregateFitness: number;
  readonly components: FitnessComponents;
  readonly gait: GaitDescriptor;
  readonly viable: boolean;
  readonly fallAtStep: number | null;
  readonly invalidReason: string | null;
  readonly actuationEnergyProxy: number;
  readonly frames: readonly EpisodeFrame[];
  readonly finalWorldChecksum: string;
}

interface WorldState {
  readonly world: RAPIER.World;
  readonly torso: RAPIER.RigidBody;
  readonly bodies: readonly {
    readonly id: string;
    readonly body: RAPIER.RigidBody;
  }[];
  readonly motors: readonly RAPIER.RevoluteImpulseJoint[];
  readonly lowerLegs: readonly RAPIER.RigidBody[];
}

const ZERO_TARGETS = Object.freeze(
  Array.from({ length: ACTUATED_JOINT_COUNT }, () => 0),
);
const MOTOR_STIFFNESS = 2_600;
const MOTOR_DAMPING = 72;
const HIP_LIMIT_RADIANS = 0.82;
const KNEE_LIMIT_RADIANS = 1.2;
const FALL_HEIGHT = 0.62;
const FALL_UPRIGHT_COSINE = 0.64;
const FALL_PERSISTENCE_STEPS = 24;
const FOOT_CONTACT_HEIGHT = 0.31;
const FITNESS_WEIGHTS = Object.freeze({
  uprightBonus: 0.2,
  fallPenalty: 2,
  actuationEnergyPenalty: 0.000_5,
  lateralDriftPenalty: 0.25,
  invalidPenalty: 100,
});

function validateConfig(config: EpisodeConfig): void {
  const values = [
    config.timestepSeconds,
    config.durationSeconds,
    config.settlingSeconds,
    config.snapshotEverySteps,
  ];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new RangeError("Episode configuration values must be finite.");
  }
  if (
    config.timestepSeconds <= 0 ||
    config.durationSeconds <= 0 ||
    config.settlingSeconds < 0 ||
    config.settlingSeconds >= config.durationSeconds ||
    !Number.isInteger(config.snapshotEverySteps) ||
    config.snapshotEverySteps <= 0 ||
    config.substeps !== 1
  ) {
    throw new RangeError(
      "Episode configuration is outside the supported deterministic bounds.",
    );
  }
  const stepCount = config.durationSeconds / config.timestepSeconds;
  const settlingSteps = config.settlingSeconds / config.timestepSeconds;
  if (!Number.isInteger(stepCount) || !Number.isInteger(settlingSteps)) {
    throw new RangeError(
      "Episode duration and settling interval must be whole fixed timesteps.",
    );
  }
}

function buildWorld(config: EpisodeConfig): WorldState {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = config.timestepSeconds;
  world.numSolverIterations = 8;
  world.numInternalPgsIterations = 2;
  world.maxCcdSubsteps = config.substeps;

  const ground = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(20, 0.1, 20).setFriction(1.1).setRestitution(0),
    ground,
  );

  const torso = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 1.28, 0)
      .setLinearDamping(0.04)
      .setAngularDamping(0.08)
      .setCanSleep(false)
      .setCcdEnabled(true),
  );
  world.createCollider(
    RAPIER.ColliderDesc.roundCuboid(0.56, 0.22, 0.34, 0.08)
      .setDensity(2.8)
      .setFriction(0.9),
    torso,
  );

  const legs = [
    { id: "front-left", x: 0.4, z: 0.42 },
    { id: "front-right", x: 0.4, z: -0.42 },
    { id: "rear-left", x: -0.4, z: 0.42 },
    { id: "rear-right", x: -0.4, z: -0.42 },
  ] as const;
  const bodies: { id: string; body: RAPIER.RigidBody }[] = [
    { id: "torso", body: torso },
  ];
  const hipMotors: RAPIER.RevoluteImpulseJoint[] = [];
  const kneeMotors: RAPIER.RevoluteImpulseJoint[] = [];
  const lowerLegs: RAPIER.RigidBody[] = [];

  legs.forEach((leg) => {
    const upperLeg = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(leg.x, 0.78, leg.z)
        .setLinearDamping(0.03)
        .setAngularDamping(0.05)
        .setCanSleep(false)
        .setCcdEnabled(true),
    );
    world.createCollider(
      RAPIER.ColliderDesc.capsule(0.2, 0.085).setDensity(1.5).setFriction(0.9),
      upperLeg,
    );
    const hipData = RAPIER.JointData.revolute(
      { x: leg.x, y: -0.22, z: leg.z },
      { x: 0, y: 0.27, z: 0 },
      { x: 0, y: 0, z: 1 },
    );
    const hip = world.createImpulseJoint(hipData, torso, upperLeg, true);
    if (!(hip instanceof RAPIER.RevoluteImpulseJoint)) {
      world.free();
      throw new TypeError(`${leg.id} hip did not create a revolute joint.`);
    }
    hip.setContactsEnabled(false);
    hip.setLimits(-HIP_LIMIT_RADIANS, HIP_LIMIT_RADIANS);
    hip.configureMotorPosition(0, MOTOR_STIFFNESS, MOTOR_DAMPING);
    hipMotors.push(hip);

    const lowerLeg = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(leg.x, 0.27, leg.z)
        .setLinearDamping(0.03)
        .setAngularDamping(0.05)
        .setCanSleep(false)
        .setCcdEnabled(true),
    );
    world.createCollider(
      RAPIER.ColliderDesc.capsule(0.19, 0.08).setDensity(1.4).setFriction(0.9),
      lowerLeg,
    );
    world.createCollider(
      RAPIER.ColliderDesc.roundCuboid(0.18, 0.055, 0.11, 0.035)
        .setTranslation(0.09, -0.22, 0)
        .setDensity(1.2)
        .setFriction(1.4)
        .setRestitution(0),
      lowerLeg,
    );
    const kneeData = RAPIER.JointData.revolute(
      { x: 0, y: -0.27, z: 0 },
      { x: 0, y: 0.24, z: 0 },
      { x: 0, y: 0, z: 1 },
    );
    const knee = world.createImpulseJoint(kneeData, upperLeg, lowerLeg, true);
    if (!(knee instanceof RAPIER.RevoluteImpulseJoint)) {
      world.free();
      throw new TypeError(`${leg.id} knee did not create a revolute joint.`);
    }
    knee.setContactsEnabled(false);
    knee.setLimits(0, KNEE_LIMIT_RADIANS);
    knee.configureMotorPosition(0, MOTOR_STIFFNESS, MOTOR_DAMPING);
    kneeMotors.push(knee);
    lowerLegs.push(lowerLeg);

    bodies.push(
      { id: `${leg.id}-upper-leg`, body: upperLeg },
      { id: `${leg.id}-lower-leg`, body: lowerLeg },
    );
  });

  return {
    world,
    torso,
    bodies,
    motors: Object.freeze([...hipMotors, ...kneeMotors]),
    lowerLegs: Object.freeze(lowerLegs),
  };
}

function physicalMotorTargets(
  controllerTargets: readonly number[],
): readonly number[] {
  return controllerTargets.map((target, index) =>
    index < 4
      ? Math.min(HIP_LIMIT_RADIANS, Math.max(-HIP_LIMIT_RADIANS, target))
      : Math.min(KNEE_LIMIT_RADIANS, Math.max(0, target)),
  );
}

function snapshotVector(vector: RAPIER.Vector): VectorSnapshot {
  return Object.freeze({ x: vector.x, y: vector.y, z: vector.z });
}

function captureFrame(
  state: WorldState,
  step: number,
  timestepSeconds: number,
): EpisodeFrame {
  const bodies = state.bodies.map(({ id, body }) => {
    const rotation = body.rotation();
    return Object.freeze({
      id,
      translation: snapshotVector(body.translation()),
      rotation: Object.freeze({
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
        w: rotation.w,
      }),
    });
  });
  return Object.freeze({
    step,
    elapsedSeconds: step * timestepSeconds,
    bodies: Object.freeze(bodies),
  });
}

function creatureCenterOfMass(state: WorldState): VectorSnapshot {
  let totalMass = 0;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const { body } of state.bodies) {
    const mass = body.mass();
    const center = body.worldCom();
    totalMass += mass;
    x += center.x * mass;
    y += center.y * mass;
    z += center.z * mass;
  }
  if (!Number.isFinite(totalMass) || totalMass <= 0) {
    return { x: Number.NaN, y: Number.NaN, z: Number.NaN };
  }
  return { x: x / totalMass, y: y / totalMass, z: z / totalMass };
}

function torsoUpY(torso: RAPIER.RigidBody): number {
  const rotation = torso.rotation();
  return 1 - 2 * (rotation.x * rotation.x + rotation.z * rotation.z);
}

function isFiniteState(state: WorldState): boolean {
  return state.bodies.every(({ body }) => {
    const translation = body.translation();
    const rotation = body.rotation();
    const linearVelocity = body.linvel();
    const angularVelocity = body.angvel();
    return [
      translation.x,
      translation.y,
      translation.z,
      rotation.x,
      rotation.y,
      rotation.z,
      rotation.w,
      linearVelocity.x,
      linearVelocity.y,
      linearVelocity.z,
      angularVelocity.x,
      angularVelocity.y,
      angularVelocity.z,
    ].every(Number.isFinite);
  });
}

function checksum(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export class DeterministicCreatureEpisode {
  private state: WorldState;
  private hasRun = false;
  private disposed = false;

  public constructor(
    private readonly controller: PeriodicControllerGenome,
    private readonly config: EpisodeConfig = DEFAULT_EPISODE_CONFIG,
  ) {
    validateControllerGenome(controller);
    validateConfig(config);
    this.state = buildWorld(config);
  }

  public reset(): void {
    this.assertAvailable();
    this.state.world.free();
    this.state = buildWorld(this.config);
    this.hasRun = false;
  }

  public replay(): EpisodeResult {
    this.reset();
    return this.run();
  }

  public run(): EpisodeResult {
    this.assertAvailable();
    if (this.hasRun) {
      throw new Error(
        "Episode has already run; call reset() or replay() before running again.",
      );
    }
    this.hasRun = true;

    const totalSteps =
      this.config.durationSeconds / this.config.timestepSeconds;
    const settlingSteps =
      this.config.settlingSeconds / this.config.timestepSeconds;
    const frames: EpisodeFrame[] = [
      captureFrame(this.state, 0, this.config.timestepSeconds),
    ];
    let referenceCenter = creatureCenterOfMass(this.state);
    let finalCenter = referenceCenter;
    let uprightSum = 0;
    let scoredSteps = 0;
    let fell = false;
    let fallAtStep: number | null = null;
    let unstableSteps = 0;
    let contactSamples = 0;
    let contactSum = 0;
    let diagonalAgreement = 0;
    let lateralAgreement = 0;
    let actuationEnergyProxy = 0;
    let previousTargets = ZERO_TARGETS;
    let invalidReason: string | null = null;
    let terminatedAtStep = 0;

    for (let step = 1; step <= totalSteps; step += 1) {
      const activeElapsed = Math.max(
        0,
        (step - settlingSteps) * this.config.timestepSeconds,
      );
      const targets =
        step <= settlingSteps
          ? ZERO_TARGETS
          : physicalMotorTargets(
              controllerTargetsAt(this.controller, activeElapsed).map(
                (target) => target * Math.min(1, activeElapsed / 0.5),
              ),
            );
      this.state.motors.forEach((motor, index) => {
        const target = targets[index];
        if (target === undefined) {
          throw new Error(`Controller did not provide target ${index}.`);
        }
        motor.configureMotorPosition(target, MOTOR_STIFFNESS, MOTOR_DAMPING);
      });
      if (step > settlingSteps) {
        targets.forEach((target, index) => {
          const previousTarget = previousTargets[index];
          if (previousTarget === undefined) {
            throw new Error(
              `Controller did not provide previous target ${index}.`,
            );
          }
          const change = target - previousTarget;
          actuationEnergyProxy +=
            (change * change) / this.config.timestepSeconds;
        });
      }
      previousTargets = targets;
      this.state.world.step();
      terminatedAtStep = step;

      if (!isFiniteState(this.state)) {
        invalidReason = `Non-finite physics state at step ${step}.`;
        break;
      }
      if (step === settlingSteps) {
        referenceCenter = creatureCenterOfMass(this.state);
      }
      if (step > settlingSteps) {
        finalCenter = creatureCenterOfMass(this.state);
        const upY = torsoUpY(this.state.torso);
        uprightSum += Math.max(0, upY);
        scoredSteps += 1;
        const unstable =
          this.state.torso.translation().y < FALL_HEIGHT ||
          upY < FALL_UPRIGHT_COSINE;
        unstableSteps = unstable ? unstableSteps + 1 : 0;
        if (fallAtStep === null && unstableSteps >= FALL_PERSISTENCE_STEPS) {
          fell = true;
          fallAtStep = step - FALL_PERSISTENCE_STEPS + 1;
        }
        const contacts = this.state.lowerLegs.map(
          (leg) => leg.translation().y <= FOOT_CONTACT_HEIGHT,
        );
        const [frontLeft, frontRight, rearLeft, rearRight] = contacts;
        contactSamples += contacts.length;
        contactSum += contacts.filter(Boolean).length;
        diagonalAgreement +=
          Number(frontLeft === rearRight) + Number(frontRight === rearLeft);
        lateralAgreement +=
          Number(frontLeft === frontRight) + Number(rearLeft === rearRight);
      }
      if (step % this.config.snapshotEverySteps === 0 || step === totalSteps) {
        frames.push(
          captureFrame(this.state, step, this.config.timestepSeconds),
        );
      }
    }

    if (invalidReason === null && !isFiniteState(this.state)) {
      invalidReason = `Non-finite physics state at step ${terminatedAtStep}.`;
    }
    const forwardProgress = finalCenter.x - referenceCenter.x;
    const uprightAverage = scoredSteps === 0 ? 0 : uprightSum / scoredSteps;
    const gait = Object.freeze({
      dutyFactor: contactSamples === 0 ? 0 : contactSum / contactSamples,
      diagonalCoordination:
        scoredSteps === 0
          ? 0.5
          : Math.min(
              1,
              Math.max(
                0,
                0.5 +
                  (diagonalAgreement - lateralAgreement) / (4 * scoredSteps),
              ),
            ),
    });
    const components: FitnessComponents = Object.freeze({
      forwardProgress,
      uprightBonus: FITNESS_WEIGHTS.uprightBonus * uprightAverage,
      fallPenalty: fell ? FITNESS_WEIGHTS.fallPenalty : 0,
      actuationEnergyPenalty:
        FITNESS_WEIGHTS.actuationEnergyPenalty * actuationEnergyProxy,
      lateralDriftPenalty:
        FITNESS_WEIGHTS.lateralDriftPenalty *
        Math.abs(finalCenter.z - referenceCenter.z),
      invalidPenalty:
        invalidReason === null ? 0 : FITNESS_WEIGHTS.invalidPenalty,
    });
    const viable = invalidReason === null && !fell;
    const aggregateFitness =
      components.forwardProgress +
      components.uprightBonus -
      components.fallPenalty -
      components.actuationEnergyPenalty -
      components.lateralDriftPenalty -
      components.invalidPenalty;
    if (!Number.isFinite(aggregateFitness)) {
      throw new Error("Fitness aggregation produced a non-finite value.");
    }

    return Object.freeze({
      provenance: Object.freeze({
        schemaVersion: EPISODE_SCHEMA_VERSION,
        rapierBindingVersion: RAPIER_BINDING_VERSION,
        rapierEngineVersion: RAPIER.version(),
        seed: this.controller.seed,
        timestepSeconds: this.config.timestepSeconds,
        substeps: this.config.substeps,
      }),
      terminatedAtStep,
      elapsedSeconds: terminatedAtStep * this.config.timestepSeconds,
      aggregateFitness,
      components,
      gait,
      viable,
      fallAtStep,
      invalidReason,
      actuationEnergyProxy,
      frames: Object.freeze(frames),
      finalWorldChecksum: checksum(this.state.world.takeSnapshot()),
    });
  }

  public dispose(): void {
    if (!this.disposed) {
      this.state.world.free();
      this.disposed = true;
    }
  }

  private assertAvailable(): void {
    if (this.disposed) {
      throw new Error("Episode has been disposed.");
    }
  }
}

export function runDeterministicEpisode(
  controller: PeriodicControllerGenome,
  config: EpisodeConfig = DEFAULT_EPISODE_CONFIG,
): EpisodeResult {
  const episode = new DeterministicCreatureEpisode(controller, config);
  try {
    return episode.run();
  } finally {
    episode.dispose();
  }
}
