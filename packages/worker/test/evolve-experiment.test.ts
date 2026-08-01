import { DEFAULT_GA_CONFIG } from "@evowalker/core";
import { describe, expect, it } from "vitest";

import {
  WORKER_PROTOCOL_VERSION,
  evolveExperiment,
  type StartEvolutionRequest,
} from "../src/index.js";

const REQUEST: StartEvolutionRequest = {
  kind: "evolve",
  protocolVersion: WORKER_PROTOCOL_VERSION,
  requestId: "unit-evolution",
  config: {
    seed: 42,
    ...DEFAULT_GA_CONFIG,
    populationSize: 4,
    generations: 1,
    eliteCount: 1,
    tournamentSize: 2,
  },
};

describe("evolution worker protocol", () => {
  it("reports generation boundaries and repeats exactly", async () => {
    const generations: number[] = [];
    const first = await evolveExperiment(REQUEST, {
      onProgress: ({ snapshot }) => generations.push(snapshot.generation),
    });
    const second = await evolveExperiment(REQUEST);

    expect(first).toEqual(second);
    expect(first.kind).toBe("evolution-completed");
    expect(generations).toEqual([0, 1]);
  });

  it("cancels with a complete recoverable generation snapshot", async () => {
    let cancel = false;
    const terminal = await evolveExperiment(REQUEST, {
      isCancelled: () => cancel,
      onProgress: () => {
        cancel = true;
      },
    });

    expect(terminal.kind).toBe("evolution-cancelled");
    expect(terminal.snapshot.generation).toBe(0);
    expect(terminal.snapshot.history).toHaveLength(1);
    expect(terminal.championEpisode.invalidReason).toBeNull();
  });
});
