import {
  DEFAULT_TERRAIN_CONFIG,
  TERRAIN_GENERATOR_VERSION,
  TERRAIN_KINDS,
  createTerrainCourse,
  validateTerrainConfig,
} from "../src/index.js";
import { describe, expect, it } from "vitest";

describe("deterministic terrain generator", () => {
  it("repeats every supported course exactly", () => {
    for (const kind of TERRAIN_KINDS) {
      const config = {
        ...DEFAULT_TERRAIN_CONFIG,
        kind,
        seed: 2_026,
      };
      expect(createTerrainCourse(config)).toEqual(createTerrainCourse(config));
    }
  });

  it("uses the seed to vary non-flat terrain without moving the baseline", () => {
    const flat7 = createTerrainCourse({
      ...DEFAULT_TERRAIN_CONFIG,
      seed: 7,
    });
    const flat99 = createTerrainCourse({
      ...DEFAULT_TERRAIN_CONFIG,
      seed: 99,
    });
    const uneven7 = createTerrainCourse({
      kind: "uneven-trail",
      seed: 7,
      generatorVersion: TERRAIN_GENERATOR_VERSION,
    });
    const uneven99 = createTerrainCourse({
      kind: "uneven-trail",
      seed: 99,
      generatorVersion: TERRAIN_GENERATOR_VERSION,
    });

    expect(flat7.blocks).toEqual(flat99.blocks);
    expect(uneven7.blocks).not.toEqual(uneven99.blocks);
  });

  it("rejects unsupported versions and unsafe seeds", () => {
    expect(() => {
      validateTerrainConfig({ ...DEFAULT_TERRAIN_CONFIG, generatorVersion: 2 });
    }).toThrow(/generator version/u);
    expect(() => {
      validateTerrainConfig({
        ...DEFAULT_TERRAIN_CONFIG,
        seed: Number.MAX_VALUE,
      });
    }).toThrow(/safe integer/u);
  });
});
