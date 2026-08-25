import {
  DEFAULT_QUALITY_DIVERSITY_CONFIG,
  DEFAULT_TERRAIN_CONFIG,
  QualityDiversitySession,
  type PeriodicControllerGenome,
  type TerrainKind,
} from "@evowalker/core";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_EPISODE_CONFIG,
  runDeterministicEpisode,
} from "../src/index.js";

const CHALLENGES: readonly TerrainKind[] = [
  "gentle-ramp",
  "curb-trail",
  "uneven-trail",
];

describe("terrain selection-signal benchmark", () => {
  it("finds viable, moving controllers on every mild deterministic course", () => {
    const outcomes: {
      terrain: TerrainKind;
      evaluations: number;
      progressMetres: number;
      cleared: string;
      niches: number;
    }[] = [];
    for (const kind of CHALLENGES) {
      const terrain = { ...DEFAULT_TERRAIN_CONFIG, kind, seed: 42 };
      const episodeConfig = { ...DEFAULT_EPISODE_CONFIG, terrain };
      const episodes = new WeakMap<
        PeriodicControllerGenome,
        ReturnType<typeof runDeterministicEpisode>
      >();
      const session = new QualityDiversitySession(
        {
          seed: 42,
          ...DEFAULT_QUALITY_DIVERSITY_CONFIG,
          terrain,
        },
        (genome) => {
          const episode = runDeterministicEpisode(genome, episodeConfig);
          episodes.set(genome, episode);
          return {
            fitness: episode.aggregateFitness,
            behavior: episode.gait,
            viable: episode.viable,
          };
        },
      );
      for (let evaluation = 0; evaluation < 96; evaluation += 1) {
        session.advance();
      }
      const snapshot = session.snapshot();
      const champion = snapshot.champion;
      expect(champion, `${kind} produced no viable champion`).not.toBeNull();
      if (champion === null) continue;
      const episode =
        episodes.get(champion.genome) ??
        runDeterministicEpisode(champion.genome, episodeConfig);

      expect(episode.viable, `${kind} champion fell`).toBe(true);
      expect(
        episode.components.forwardProgress,
        `${kind} exposed no meaningful forward signal`,
      ).toBeGreaterThanOrEqual(0.25);
      expect(
        episode.terrain.obstaclesCleared,
        `${kind} champion did not cross a terrain feature after ${episode.components.forwardProgress.toFixed(4)} m`,
      ).toBeGreaterThanOrEqual(1);
      expect(snapshot.archive.length).toBeGreaterThanOrEqual(3);
      expect(runDeterministicEpisode(champion.genome, episodeConfig)).toEqual(
        episode,
      );
      outcomes.push({
        terrain: kind,
        evaluations: snapshot.evaluations,
        progressMetres: Number(episode.components.forwardProgress.toFixed(4)),
        cleared: `${String(episode.terrain.obstaclesCleared)}/${String(episode.terrain.obstaclesTotal)}`,
        niches: snapshot.archive.length,
      });
    }
    console.table(outcomes);
  }, 60_000);
});
