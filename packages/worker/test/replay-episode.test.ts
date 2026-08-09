import { createSeededController } from "@evowalker/core";
import { runDeterministicEpisode } from "@evowalker/sim";
import { describe, expect, it } from "vitest";
import {
  WORKER_PROTOCOL_VERSION,
  replayEpisode,
  type ReplayEpisodeRequest,
} from "../src/index.js";

describe("episode replay protocol", () => {
  it("returns the same deterministic episode as direct simulation", () => {
    const genome = createSeededController(12_345);
    const request: ReplayEpisodeRequest = {
      kind: "replay",
      protocolVersion: WORKER_PROTOCOL_VERSION,
      requestId: "replay-test",
      genome,
    };

    expect(replayEpisode(request)).toEqual({
      kind: "replay-completed",
      protocolVersion: WORKER_PROTOCOL_VERSION,
      requestId: "replay-test",
      episode: runDeterministicEpisode(genome),
    });
  });

  it("rejects an unsupported protocol version", () => {
    expect(() =>
      replayEpisode({
        kind: "replay",
        protocolVersion: WORKER_PROTOCOL_VERSION + 1,
        requestId: "future-replay",
        genome: createSeededController(9),
      }),
    ).toThrow("Unsupported worker protocol version.");
  });
});
