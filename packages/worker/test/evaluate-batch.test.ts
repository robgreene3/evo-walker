import { createSeededController } from "@evowalker/core";
import { describe, expect, it } from "vitest";
import {
  WORKER_PROTOCOL_VERSION,
  evaluateBatch,
  type BatchEvaluationRequest,
} from "../src/index.js";

function request(size = 3): BatchEvaluationRequest {
  return {
    kind: "evaluate",
    protocolVersion: WORKER_PROTOCOL_VERSION,
    requestId: "unit-batch",
    genomes: Array.from({ length: size }, (_, index) =>
      createSeededController(index + 1),
    ),
  };
}
describe("batch evaluation protocol", () => {
  it("reports monotonic progress and deterministic results", async () => {
    const progress: number[] = [];
    const first = await evaluateBatch(request(), {
      onProgress: (message) => progress.push(message.completed),
    });
    const second = await evaluateBatch(request());
    expect(first).toEqual(second);
    expect(progress).toEqual([1, 2, 3]);
  });
  it("cancels cooperatively at a clean episode boundary", async () => {
    let cancel = false;
    const result = await evaluateBatch(request(4), {
      isCancelled: () => cancel,
      onProgress: ({ completed }) => {
        cancel = completed === 2;
      },
    });
    expect(result).toEqual({
      kind: "cancelled",
      protocolVersion: WORKER_PROTOCOL_VERSION,
      requestId: "unit-batch",
      completed: 2,
    });
  });
});
