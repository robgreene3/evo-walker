import { z } from "zod";

import { ACTUATED_JOINT_COUNT, CONTROLLER_BOUNDS } from "./controller.js";
import type { ControllerEvolutionSnapshot } from "./genetic-algorithm.js";
import { PRNG_IDENTITY } from "./prng.js";

export const EXPERIMENT_SCHEMA_VERSION = 1 as const;
export const EXPERIMENT_BUILD_VERSION = "0.0.0" as const;
export const MAX_EXPERIMENT_BYTES = 5_000_000;

const finite = z.number();
const safeInteger = z.number().int();
const identifier = z.string().min(1).max(128);
const vectorSchema = z.strictObject({ x: finite, y: finite, z: finite });
const rotationSchema = vectorSchema.extend({ w: finite });
const jointSchema = z.strictObject({
  amplitude: finite
    .min(CONTROLLER_BOUNDS.amplitude.minimum)
    .max(CONTROLLER_BOUNDS.amplitude.maximum),
  frequencyHz: finite
    .min(CONTROLLER_BOUNDS.frequencyHz.minimum)
    .max(CONTROLLER_BOUNDS.frequencyHz.maximum),
  phaseRadians: finite
    .min(CONTROLLER_BOUNDS.phaseRadians.minimum)
    .max(CONTROLLER_BOUNDS.phaseRadians.maximum),
  offset: finite
    .min(CONTROLLER_BOUNDS.offset.minimum)
    .max(CONTROLLER_BOUNDS.offset.maximum),
});
const genomeSchema = z.strictObject({
  seed: safeInteger,
  joints: z.array(jointSchema).length(ACTUATED_JOINT_COUNT),
});
const gaConfigSchema = z.strictObject({
  seed: safeInteger,
  populationSize: z.number().int().min(2).max(100),
  generations: z.number().int().min(1).max(1_000),
  eliteCount: z.number().int().min(1).max(99),
  tournamentSize: z.number().int().min(2).max(100),
  crossoverRate: finite.min(0).max(1),
  mutationRate: finite.min(0).max(1),
  mutationScale: finite.min(0).max(10),
});
const lineageSchema = z.strictObject({
  id: identifier,
  generation: z.number().int().min(0).max(1_000),
  genomeSeed: safeInteger,
  parentIds: z.array(identifier).max(2),
  eliteCarryover: z.boolean(),
});
const generationSummarySchema = z.strictObject({
  generation: z.number().int().min(0).max(1_000),
  bestFitness: finite,
  medianFitness: finite,
  meanFitness: finite,
  duplicateRate: finite.min(0).max(1),
  meanGenotypeDistance: finite.min(0).max(1),
  championLineageId: identifier,
  champion: genomeSchema,
});
const evaluatedControllerSchema = z.strictObject({
  genome: genomeSchema,
  fitness: finite,
  lineageId: identifier,
});
const snapshotSchema = z.strictObject({
  config: gaConfigSchema,
  generation: z.number().int().min(0).max(1_000),
  complete: z.boolean(),
  history: z.array(generationSummarySchema).min(1).max(1_001),
  champion: evaluatedControllerSchema,
  lineage: z.array(lineageSchema).min(2).max(100_100),
});
const fitnessComponentsSchema = z.strictObject({
  forwardProgress: finite,
  uprightBonus: finite,
  fallPenalty: finite,
  actuationEnergyPenalty: finite,
  lateralDriftPenalty: finite,
  invalidPenalty: finite,
});
const episodeSchema = z.strictObject({
  provenance: z.strictObject({
    schemaVersion: z.literal(1),
    rapierBindingVersion: z.literal("0.19.3"),
    rapierEngineVersion: z.string().min(1).max(64),
    seed: safeInteger,
    timestepSeconds: finite.positive(),
    substeps: z.literal(1),
  }),
  terminatedAtStep: z.number().int().min(0).max(100_000),
  elapsedSeconds: finite.nonnegative(),
  aggregateFitness: finite,
  components: fitnessComponentsSchema,
  gait: z.strictObject({
    dutyFactor: finite.min(0).max(1),
    diagonalCoordination: finite.min(0).max(1),
  }),
  viable: z.boolean(),
  fallAtStep: z.number().int().min(0).max(100_000).nullable(),
  invalidReason: z.string().min(1).max(512).nullable(),
  actuationEnergyProxy: finite.nonnegative(),
  frames: z
    .array(
      z.strictObject({
        step: z.number().int().min(0).max(100_000),
        elapsedSeconds: finite.nonnegative(),
        bodies: z
          .array(
            z.strictObject({
              id: identifier,
              translation: vectorSchema,
              rotation: rotationSchema,
            }),
          )
          .min(1)
          .max(16),
      }),
    )
    .min(1)
    .max(10_000),
  finalWorldChecksum: z.string().regex(/^[0-9a-f]{8}$/u),
});
const physicsSchema = z.strictObject({
  rapierBindingVersion: z.literal("0.19.3"),
  rapierEngineVersion: z.string().min(1).max(64),
  timestepSeconds: finite.positive(),
  substeps: z.literal(1),
  durationSeconds: finite.positive(),
  settlingSeconds: finite.nonnegative(),
  snapshotEverySteps: z.number().int().positive().max(100_000),
});

export const experimentDocumentSchema = z
  .strictObject({
    schemaVersion: z.literal(EXPERIMENT_SCHEMA_VERSION),
    buildVersion: z.literal(EXPERIMENT_BUILD_VERSION),
    prng: z.strictObject({ algorithm: z.literal(PRNG_IDENTITY) }),
    physics: physicsSchema,
    snapshot: snapshotSchema,
    championEpisode: episodeSchema,
  })
  .superRefine((document, context) => {
    const { snapshot, championEpisode, physics } = document;
    const finalSummary = snapshot.history.at(-1);
    const lineageIds = new Set(snapshot.lineage.map(({ id }) => id));
    const expectedLineageLength =
      snapshot.config.populationSize * (snapshot.generation + 1);
    const issue = (message: string): void => {
      context.addIssue({ code: "custom", message });
    };
    if (snapshot.history.length !== snapshot.generation + 1)
      issue("History length does not match the saved generation.");
    if (snapshot.lineage.length !== expectedLineageLength)
      issue("Lineage length does not match population history.");
    if (lineageIds.size !== snapshot.lineage.length)
      issue("Lineage identifiers must be unique.");
    if (!lineageIds.has(snapshot.champion.lineageId))
      issue("Champion lineage does not exist in the saved lineage.");
    if (finalSummary?.championLineageId !== snapshot.champion.lineageId)
      issue("Final generation champion does not match the saved champion.");
    if (
      snapshot.complete !==
      (snapshot.generation === snapshot.config.generations)
    )
      issue("Completion state does not match the saved generation.");
    if (championEpisode.provenance.seed !== snapshot.champion.genome.seed)
      issue("Champion episode seed does not match the champion genome.");
    if (championEpisode.aggregateFitness !== snapshot.champion.fitness)
      issue("Champion episode fitness does not match the saved champion.");
    if (
      physics.rapierEngineVersion !==
        championEpisode.provenance.rapierEngineVersion ||
      physics.timestepSeconds !== championEpisode.provenance.timestepSeconds
    )
      issue("Physics metadata does not match the champion episode.");
  });

export type ExperimentDocument = z.infer<typeof experimentDocumentSchema>;
export type ExperimentEpisode = ExperimentDocument["championEpisode"];

export class ExperimentImportError extends Error {
  public override readonly name = "ExperimentImportError";
}

function freezeRecursively<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeRecursively(child);
    Object.freeze(value);
  }
  return value;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function validateDocument(value: unknown): ExperimentDocument {
  const result = experimentDocumentSchema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new ExperimentImportError(
      first === undefined
        ? "Experiment validation failed."
        : `Experiment validation failed: ${first.message}`,
    );
  }
  return freezeRecursively(result.data);
}

export function createExperimentDocument(
  snapshot: ControllerEvolutionSnapshot,
  championEpisode: unknown,
): ExperimentDocument {
  const parsedEpisode = episodeSchema.parse(championEpisode);
  return validateDocument({
    schemaVersion: EXPERIMENT_SCHEMA_VERSION,
    buildVersion: EXPERIMENT_BUILD_VERSION,
    prng: { algorithm: PRNG_IDENTITY },
    physics: {
      rapierBindingVersion: parsedEpisode.provenance.rapierBindingVersion,
      rapierEngineVersion: parsedEpisode.provenance.rapierEngineVersion,
      timestepSeconds: parsedEpisode.provenance.timestepSeconds,
      substeps: parsedEpisode.provenance.substeps,
      durationSeconds: 6,
      settlingSeconds: 0.75,
      snapshotEverySteps: 12,
    },
    snapshot,
    championEpisode: parsedEpisode,
  });
}

export function serializeExperimentDocument(document: unknown): string {
  const serialized = JSON.stringify(validateDocument(document));
  if (byteLength(serialized) > MAX_EXPERIMENT_BYTES) {
    throw new ExperimentImportError(
      `Experiment exceeds the ${String(MAX_EXPERIMENT_BYTES)} byte limit.`,
    );
  }
  return serialized;
}

export function parseExperimentJson(serialized: string): ExperimentDocument {
  if (byteLength(serialized) > MAX_EXPERIMENT_BYTES) {
    throw new ExperimentImportError(
      `Experiment exceeds the ${String(MAX_EXPERIMENT_BYTES)} byte limit.`,
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch {
    throw new ExperimentImportError("Experiment is not valid JSON.");
  }
  if (
    value !== null &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    value.schemaVersion !== EXPERIMENT_SCHEMA_VERSION
  ) {
    throw new ExperimentImportError(
      `Unsupported experiment schema version: ${String(value.schemaVersion)}.`,
    );
  }
  return validateDocument(value);
}
