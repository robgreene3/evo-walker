import { z } from "zod";

import { ACTUATED_JOINT_COUNT, CONTROLLER_BOUNDS } from "./controller.js";
import {
  EXPERIMENT_BUILD_VERSION,
  ExperimentImportError,
} from "./experiment.js";
import { PRNG_IDENTITY } from "./prng.js";
import {
  DEFAULT_TERRAIN_CONFIG,
  TERRAIN_GENERATOR_VERSION,
  TERRAIN_KINDS,
  createTerrainCourse,
} from "./terrain.js";
import type { QualityDiversitySnapshot } from "./quality-diversity.js";

export const QUALITY_DIVERSITY_EXPERIMENT_SCHEMA_VERSION = 4 as const;
export const MAX_QUALITY_DIVERSITY_EXPERIMENT_BYTES = 8_000_000;

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
const behaviorSchema = z.strictObject({
  dutyFactor: finite.min(0).max(1),
  diagonalCoordination: finite.min(0).max(1),
});
const terrainSchema = z.strictObject({
  kind: z.enum(TERRAIN_KINDS),
  seed: safeInteger,
  generatorVersion: z.literal(TERRAIN_GENERATOR_VERSION),
});
const episodeDurationSchema = z.union([z.literal(6), z.literal(30)]);
const legacyV2ConfigSchema = z.strictObject({
  seed: safeInteger,
  initialPopulation: z.number().int().min(4).max(256),
  archiveBins: z.number().int().min(4).max(32),
  crossoverRate: finite.min(0).max(1),
  mutationRate: finite.min(0).max(1),
  mutationScale: finite.min(0).max(10),
  randomInjectionRate: finite.min(0).max(1),
});
const legacyV3ConfigSchema = legacyV2ConfigSchema.extend({
  terrain: terrainSchema,
});
const configSchema = legacyV3ConfigSchema.extend({
  episodeDurationSeconds: episodeDurationSchema,
});
const archiveEntrySchema = z.strictObject({
  cellIndex: z.number().int().min(0).max(1_023),
  xIndex: z.number().int().min(0).max(31),
  yIndex: z.number().int().min(0).max(31),
  genome: genomeSchema,
  fitness: finite,
  behavior: behaviorSchema,
  lineageId: identifier,
  evaluation: z.number().int().positive(),
});
const lineageSchema = z.strictObject({
  id: identifier,
  evaluation: z.number().int().positive(),
  genomeSeed: safeInteger,
  parentIds: z.array(identifier).max(2),
  origin: z.enum(["founder", "offspring", "immigrant"]),
});
const historySchema = z.strictObject({
  evaluation: z.number().int().positive(),
  bestFitness: finite.nullable(),
  archiveSize: z.number().int().min(0).max(1_024),
  archiveCoverage: finite.min(0).max(1),
});
const prngSchema = z.strictObject({
  algorithm: z.literal(PRNG_IDENTITY),
  state: z.number().int().min(0).max(0xffff_ffff),
});
const snapshotSchema = z.strictObject({
  config: configSchema,
  evaluations: z.number().int().positive(),
  archive: z.array(archiveEntrySchema).max(1_024),
  champion: archiveEntrySchema.nullable(),
  lineage: z.array(lineageSchema).max(4_096),
  history: z.array(historySchema).min(1).max(512),
  prng: prngSchema,
});
const legacyV2SnapshotSchema = snapshotSchema.extend({
  config: legacyV2ConfigSchema,
});
const legacyV3SnapshotSchema = snapshotSchema.extend({
  config: legacyV3ConfigSchema,
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
    terrain: terrainSchema,
  }),
  terminatedAtStep: z.number().int().min(0).max(100_000),
  elapsedSeconds: finite.nonnegative(),
  aggregateFitness: finite,
  components: fitnessComponentsSchema,
  gait: behaviorSchema,
  terrain: z.strictObject({
    label: z.string().min(1).max(128),
    obstaclesTotal: z.number().int().min(0).max(128),
    obstaclesCleared: z.number().int().min(0).max(128),
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

const legacyEpisodeSchema = episodeSchema
  .omit({ provenance: true, terrain: true })
  .extend({
    provenance: z.strictObject({
      schemaVersion: z.literal(1),
      rapierBindingVersion: z.literal("0.19.3"),
      rapierEngineVersion: z.string().min(1).max(64),
      seed: safeInteger,
      timestepSeconds: finite.positive(),
      substeps: z.literal(1),
    }),
  });

const legacyV2DocumentSchema = z.strictObject({
  schemaVersion: z.literal(2),
  buildVersion: z.literal(EXPERIMENT_BUILD_VERSION),
  mode: z.literal("continuous-quality-diversity"),
  prng: z.strictObject({ algorithm: z.literal(PRNG_IDENTITY) }),
  physics: z.strictObject({
    rapierBindingVersion: z.literal("0.19.3"),
    rapierEngineVersion: z.string().min(1).max(64),
    timestepSeconds: finite.positive(),
    substeps: z.literal(1),
    durationSeconds: z.literal(6),
    settlingSeconds: finite.nonnegative(),
    snapshotEverySteps: z.number().int().positive().max(100_000),
  }),
  snapshot: legacyV2SnapshotSchema,
  championEpisode: legacyEpisodeSchema.nullable(),
});

const legacyV3DocumentSchema = z.strictObject({
  schemaVersion: z.literal(3),
  buildVersion: z.literal(EXPERIMENT_BUILD_VERSION),
  mode: z.literal("continuous-quality-diversity"),
  prng: z.strictObject({ algorithm: z.literal(PRNG_IDENTITY) }),
  physics: z.strictObject({
    rapierBindingVersion: z.literal("0.19.3"),
    rapierEngineVersion: z.string().min(1).max(64),
    timestepSeconds: finite.positive(),
    substeps: z.literal(1),
    durationSeconds: z.literal(6),
    settlingSeconds: finite.nonnegative(),
    snapshotEverySteps: z.number().int().positive().max(100_000),
    terrain: terrainSchema,
  }),
  snapshot: legacyV3SnapshotSchema,
  championEpisode: episodeSchema.nullable(),
});

export const qualityDiversityExperimentDocumentSchema = z
  .strictObject({
    schemaVersion: z.literal(QUALITY_DIVERSITY_EXPERIMENT_SCHEMA_VERSION),
    buildVersion: z.literal(EXPERIMENT_BUILD_VERSION),
    mode: z.literal("continuous-quality-diversity"),
    prng: z.strictObject({ algorithm: z.literal(PRNG_IDENTITY) }),
    physics: z.strictObject({
      rapierBindingVersion: z.literal("0.19.3"),
      rapierEngineVersion: z.string().min(1).max(64),
      timestepSeconds: finite.positive(),
      substeps: z.literal(1),
      durationSeconds: episodeDurationSchema,
      settlingSeconds: finite.nonnegative(),
      snapshotEverySteps: z.number().int().positive().max(100_000),
      terrain: terrainSchema,
    }),
    snapshot: snapshotSchema,
    championEpisode: episodeSchema.nullable(),
  })
  .superRefine((document, context) => {
    const issue = (message: string): void => {
      context.addIssue({ code: "custom", message });
    };
    const { snapshot, championEpisode, physics } = document;
    const cells = new Set<number>();
    for (const entry of snapshot.archive) {
      if (cells.has(entry.cellIndex))
        issue("Archive cell identifiers must be unique.");
      cells.add(entry.cellIndex);
      if (
        entry.xIndex >= snapshot.config.archiveBins ||
        entry.yIndex >= snapshot.config.archiveBins ||
        entry.cellIndex !==
          entry.yIndex * snapshot.config.archiveBins + entry.xIndex
      ) {
        issue("Archive entry coordinates do not match its cell identifier.");
      }
      if (entry.evaluation > snapshot.evaluations) {
        issue("Archive entry occurs after the saved evaluation boundary.");
      }
    }
    if (snapshot.evaluations < snapshot.config.initialPopulation) {
      issue("Saved evaluations do not include the initial population.");
    }
    const expectedCoverage =
      snapshot.archive.length /
      (snapshot.config.archiveBins * snapshot.config.archiveBins);
    const finalHistory = snapshot.history.at(-1);
    if (
      finalHistory !== undefined &&
      Math.abs(finalHistory.archiveCoverage - expectedCoverage) > 1e-12
    ) {
      issue("Archive coverage does not match the saved archive.");
    }
    if ((snapshot.champion === null) !== (championEpisode === null)) {
      issue(
        "Champion metadata and replay must either both exist or both be absent.",
      );
    }
    if (snapshot.champion !== null) {
      const archivedChampion = snapshot.archive.find(
        ({ lineageId }) => lineageId === snapshot.champion?.lineageId,
      );
      if (archivedChampion === undefined) {
        issue("Champion does not exist in the saved archive.");
      }
    }
    if (snapshot.champion !== null && championEpisode !== null) {
      if (championEpisode.provenance.seed !== snapshot.champion.genome.seed) {
        issue("Champion episode seed does not match the champion genome.");
      }
      if (championEpisode.aggregateFitness !== snapshot.champion.fitness) {
        issue("Champion episode fitness does not match the saved champion.");
      }
      if (!championEpisode.viable) {
        issue("A non-viable episode cannot be saved as archive champion.");
      }
      if (
        championEpisode.gait.dutyFactor !==
          snapshot.champion.behavior.dutyFactor ||
        championEpisode.gait.diagonalCoordination !==
          snapshot.champion.behavior.diagonalCoordination
      ) {
        issue("Champion behavior does not match the replay descriptor.");
      }
    }
    if (
      championEpisode !== null &&
      (physics.rapierEngineVersion !==
        championEpisode.provenance.rapierEngineVersion ||
        physics.timestepSeconds !== championEpisode.provenance.timestepSeconds)
    ) {
      issue("Physics metadata does not match the champion episode.");
    }
    if (
      JSON.stringify(physics.terrain) !==
        JSON.stringify(snapshot.config.terrain) ||
      (championEpisode !== null &&
        JSON.stringify(physics.terrain) !==
          JSON.stringify(championEpisode.provenance.terrain))
    ) {
      issue("Terrain metadata does not match the saved experiment.");
    }
    if (
      physics.durationSeconds !== snapshot.config.episodeDurationSeconds ||
      (championEpisode !== null &&
        championEpisode.elapsedSeconds !== physics.durationSeconds)
    ) {
      issue("Episode duration does not match the saved experiment.");
    }
    if (championEpisode !== null) {
      const course = createTerrainCourse(physics.terrain);
      if (
        championEpisode.terrain.label !== course.label ||
        championEpisode.terrain.obstaclesTotal !== course.blocks.length ||
        championEpisode.terrain.obstaclesCleared >
          championEpisode.terrain.obstaclesTotal
      ) {
        issue("Terrain outcome does not match the generated course.");
      }
    }
  });

export type QualityDiversityExperimentDocument = z.infer<
  typeof qualityDiversityExperimentDocumentSchema
>;
export type QualityDiversityExperimentEpisode =
  QualityDiversityExperimentDocument["championEpisode"];

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

function validateDocument(value: unknown): QualityDiversityExperimentDocument {
  const result = qualityDiversityExperimentDocumentSchema.safeParse(value);
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

export function createQualityDiversityExperimentDocument(
  snapshot: QualityDiversitySnapshot,
  championEpisode: unknown,
): QualityDiversityExperimentDocument {
  const parsedEpisode =
    championEpisode === null ? null : episodeSchema.parse(championEpisode);
  return validateDocument({
    schemaVersion: QUALITY_DIVERSITY_EXPERIMENT_SCHEMA_VERSION,
    buildVersion: EXPERIMENT_BUILD_VERSION,
    mode: "continuous-quality-diversity",
    prng: { algorithm: PRNG_IDENTITY },
    physics: {
      rapierBindingVersion: "0.19.3",
      rapierEngineVersion:
        parsedEpisode?.provenance.rapierEngineVersion ?? "unknown",
      timestepSeconds: parsedEpisode?.provenance.timestepSeconds ?? 1 / 120,
      substeps: 1,
      durationSeconds: snapshot.config.episodeDurationSeconds,
      settlingSeconds: 0.75,
      snapshotEverySteps: 12,
      terrain: snapshot.config.terrain,
    },
    snapshot,
    championEpisode: parsedEpisode,
  });
}

export function serializeQualityDiversityExperimentDocument(
  document: unknown,
): string {
  const serialized = JSON.stringify(validateDocument(document));
  if (byteLength(serialized) > MAX_QUALITY_DIVERSITY_EXPERIMENT_BYTES) {
    throw new ExperimentImportError(
      `Experiment exceeds the ${String(MAX_QUALITY_DIVERSITY_EXPERIMENT_BYTES)} byte limit.`,
    );
  }
  return serialized;
}

export function parseQualityDiversityExperimentJson(
  serialized: string,
): QualityDiversityExperimentDocument {
  if (byteLength(serialized) > MAX_QUALITY_DIVERSITY_EXPERIMENT_BYTES) {
    throw new ExperimentImportError(
      `Experiment exceeds the ${String(MAX_QUALITY_DIVERSITY_EXPERIMENT_BYTES)} byte limit.`,
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
    value.schemaVersion === 2
  ) {
    const legacyResult = legacyV2DocumentSchema.safeParse(value);
    if (!legacyResult.success) {
      const first = legacyResult.error.issues[0];
      throw new ExperimentImportError(
        first === undefined
          ? "Schema-v2 experiment migration validation failed."
          : `Schema-v2 experiment migration validation failed: ${first.message}`,
      );
    }
    const legacy = legacyResult.data;
    const terrain = DEFAULT_TERRAIN_CONFIG;
    const episodeDurationSeconds = 6;
    return validateDocument({
      ...legacy,
      schemaVersion: QUALITY_DIVERSITY_EXPERIMENT_SCHEMA_VERSION,
      physics: { ...legacy.physics, terrain },
      snapshot: {
        ...legacy.snapshot,
        config: {
          ...legacy.snapshot.config,
          terrain,
          episodeDurationSeconds,
        },
      },
      championEpisode:
        legacy.championEpisode === null
          ? null
          : {
              ...legacy.championEpisode,
              provenance: {
                ...legacy.championEpisode.provenance,
                terrain,
              },
              terrain: {
                label: "Flat proving ground",
                obstaclesTotal: 0,
                obstaclesCleared: 0,
              },
            },
    });
  }
  if (
    value !== null &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    value.schemaVersion === 3
  ) {
    const legacyResult = legacyV3DocumentSchema.safeParse(value);
    if (!legacyResult.success) {
      const first = legacyResult.error.issues[0];
      throw new ExperimentImportError(
        first === undefined
          ? "Schema-v3 experiment migration validation failed."
          : `Schema-v3 experiment migration validation failed: ${first.message}`,
      );
    }
    const legacy = legacyResult.data;
    return validateDocument({
      ...legacy,
      schemaVersion: QUALITY_DIVERSITY_EXPERIMENT_SCHEMA_VERSION,
      snapshot: {
        ...legacy.snapshot,
        config: {
          ...legacy.snapshot.config,
          episodeDurationSeconds: 6,
        },
      },
    });
  }
  if (
    value !== null &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    value.schemaVersion !== QUALITY_DIVERSITY_EXPERIMENT_SCHEMA_VERSION
  ) {
    throw new ExperimentImportError(
      `Unsupported experiment schema version: ${String(value.schemaVersion)}. EvoWalker archive mode requires version 4.`,
    );
  }
  return validateDocument(value);
}
