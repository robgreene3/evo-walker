import { createSeededController } from "@evowalker/core";
import { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";

import {
  WORKER_PROTOCOL_VERSION,
  evaluateBatch,
  type BatchEvaluationRequest,
  type WorkerResponse,
} from "../src/index.js";

function createRequest(
  requestId: string,
  size: number,
): BatchEvaluationRequest {
  return {
    kind: "evaluate",
    protocolVersion: WORKER_PROTOCOL_VERSION,
    requestId,
    genomes: Array.from({ length: size }, (_, index) =>
      createSeededController(10_000 + index),
    ),
  };
}

async function runWorker(
  request: BatchEvaluationRequest,
  cancelAfter?: number,
): Promise<{ readonly terminal: WorkerResponse; readonly progress: number[] }> {
  const worker = new Worker(new URL("../dist/node-worker.js", import.meta.url));
  const progress: number[] = [];
  try {
    const terminal = await new Promise<WorkerResponse>((resolve, reject) => {
      worker.on("message", (message: WorkerResponse) => {
        if (message.kind === "progress") {
          progress.push(message.completed);
          if (message.completed === cancelAfter) {
            worker.postMessage({
              kind: "cancel",
              protocolVersion: WORKER_PROTOCOL_VERSION,
              requestId: request.requestId,
            });
          }
          return;
        }
        resolve(message);
      });
      worker.once("error", reject);
      worker.postMessage(request);
    });
    return { terminal, progress };
  } finally {
    await worker.terminate();
  }
}

describe("worker evaluation boundary", () => {
  it("matches direct evaluation and cancels at an episode boundary", async () => {
    const request = createRequest("equivalence", 5);
    const direct = await evaluateBatch(request);
    const worker = await runWorker(request);

    expect(worker.terminal).toEqual(direct);
    expect(worker.progress).toEqual([1, 2, 3, 4, 5]);

    const cancelled = await runWorker(createRequest("cancel", 8), 2);
    expect(cancelled.terminal).toEqual({
      kind: "cancelled",
      protocolVersion: WORKER_PROTOCOL_VERSION,
      requestId: "cancel",
      completed: 2,
    });
    expect(cancelled.progress).toEqual([1, 2]);
  });
});
