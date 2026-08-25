import { Mulberry32 } from "./prng.js";

export const TERRAIN_GENERATOR_VERSION = 1 as const;

export const TERRAIN_KINDS = [
  "flat",
  "gentle-ramp",
  "curb-trail",
  "uneven-trail",
] as const;

export type TerrainKind = (typeof TERRAIN_KINDS)[number];

export interface TerrainConfig {
  readonly kind: TerrainKind;
  readonly seed: number;
  readonly generatorVersion: typeof TERRAIN_GENERATOR_VERSION;
}

export interface TerrainBlock {
  readonly id: string;
  readonly center: Readonly<{ x: number; y: number; z: number }>;
  readonly halfExtents: Readonly<{ x: number; y: number; z: number }>;
  readonly rotationZRadians: number;
}

export interface TerrainCourse {
  readonly config: TerrainConfig;
  readonly label: string;
  readonly description: string;
  readonly blocks: readonly TerrainBlock[];
}

export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = Object.freeze({
  kind: "flat",
  seed: 42,
  generatorVersion: TERRAIN_GENERATOR_VERSION,
});

function freezeBlock(block: TerrainBlock): TerrainBlock {
  return Object.freeze({
    ...block,
    center: Object.freeze({ ...block.center }),
    halfExtents: Object.freeze({ ...block.halfExtents }),
  });
}

export function validateTerrainConfig(
  config: Readonly<{ kind: string; seed: number; generatorVersion: number }>,
): void {
  if (!TERRAIN_KINDS.includes(config.kind as TerrainKind)) {
    throw new RangeError(`Unsupported terrain kind: ${config.kind}.`);
  }
  if (!Number.isSafeInteger(config.seed)) {
    throw new TypeError("Terrain seed must be a safe integer.");
  }
  if (config.generatorVersion !== TERRAIN_GENERATOR_VERSION) {
    throw new RangeError(
      `Unsupported terrain generator version: ${String(config.generatorVersion)}.`,
    );
  }
}

export function createTerrainCourse(config: TerrainConfig): TerrainCourse {
  validateTerrainConfig(config);
  const prng = new Mulberry32(config.seed);
  const blocks: TerrainBlock[] = [];
  let label = "Flat proving ground";
  let description = "The verified level-ground compatibility course.";

  if (config.kind === "gentle-ramp") {
    const angle = (5 + prng.range(-0.35, 0.35)) * (Math.PI / 180);
    const halfLength = 0.25;
    const halfHeight = 0.055;
    blocks.push(
      freezeBlock({
        id: "ramp-1",
        center: {
          x: 0.58,
          y: Math.sin(angle) * halfLength - Math.cos(angle) * halfHeight,
          z: 0,
        },
        halfExtents: { x: halfLength, y: halfHeight, z: 1.7 },
        rotationZRadians: angle,
      }),
    );
    label = "Gentle rise";
    description = "A seeded five-degree climb that rewards stable clearance.";
  }

  if (config.kind === "curb-trail") {
    const firstHeight = prng.range(0.018, 0.028);
    const secondHeight = prng.range(0.035, 0.05);
    [
      { id: "curb-1", x: 0.92, halfLength: 0.13, height: firstHeight },
      { id: "curb-2", x: 1.25, halfLength: 0.14, height: secondHeight },
    ].forEach(({ id, x, halfLength, height }) => {
      blocks.push(
        freezeBlock({
          id,
          center: { x, y: height / 2, z: 0 },
          halfExtents: { x: halfLength, y: height / 2, z: 1.65 },
          rotationZRadians: 0,
        }),
      );
    });
    label = "Curb trail";
    description = "Two broad, low steps with deterministic seeded heights.";
  }

  if (config.kind === "uneven-trail") {
    for (let index = 0; index < 5; index += 1) {
      const height = prng.range(0.018, 0.06);
      blocks.push(
        freezeBlock({
          id: `uneven-${String(index + 1)}`,
          center: { x: 0.84 + index * 0.32, y: height / 2, z: 0 },
          halfExtents: { x: 0.16, y: height / 2, z: 1.6 },
          rotationZRadians: 0,
        }),
      );
    }
    label = "Uneven trail";
    description =
      "A seeded ribbon of shallow height changes under every stride.";
  }

  return Object.freeze({
    config: Object.freeze({ ...config }),
    label,
    description,
    blocks: Object.freeze(blocks),
  });
}
