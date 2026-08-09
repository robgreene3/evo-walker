import {
  DEFAULT_QUALITY_DIVERSITY_CONFIG,
  type QualityDiversitySnapshot,
} from "@evowalker/core";
import { describe, expect, it } from "vitest";

import {
  WORKER_PROTOCOL_VERSION,
  exploreExperiment,
  type StartExplorationRequest,
} from "../src/index.js";

const REQUEST: StartExplorationRequest = {
  kind: "explore",
  protocolVersion: WORKER_PROTOCOL_VERSION,
  requestId: "unit-exploration",
  config: {
    seed: 42,
    ...DEFAULT_QUALITY_DIVERSITY_CONFIG,
    initialPopulation: 4,
    archiveBins: 4,
  },
};

async function runUntil(
  evaluations: number,
  checkpoint?: QualityDiversitySnapshot,
) {
  let cancel = false;
  const request: StartExplorationRequest =
    checkpoint === undefined ? REQUEST : { ...REQUEST, checkpoint };
  return exploreExperiment(request, {
    isCancelled: () => cancel,
    onProgress: ({ snapshot }) => {
      if (snapshot.evaluations >= evaluations) cancel = true;
    },
    yieldControl: () => Promise.resolve(),
  });
}

describe("continuous exploration worker", () => {
  it("stops at an evaluation boundary with a viable replay", async () => {
    const terminal = await runUntil(8);

    expect(terminal.kind).toBe("exploration-stopped");
    expect(terminal.snapshot.evaluations).toBe(8);
    expect(terminal.snapshot.champion).not.toBeNull();
    expect(terminal.championEpisode?.viable).toBe(true);
  });

  it("resumes deterministically from a checkpoint", async () => {
    const staged = await runUntil(6);
    const resumed = await runUntil(10, staged.snapshot);
    const uninterrupted = await runUntil(10);

    expect(resumed.snapshot).toEqual(uninterrupted.snapshot);
    expect(resumed.championEpisode).toEqual(uninterrupted.championEpisode);
  });
});
