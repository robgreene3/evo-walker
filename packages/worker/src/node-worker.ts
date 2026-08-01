import { parentPort } from "node:worker_threads";
import { evaluateBatch } from "./evaluate-batch.js";
import {
  WORKER_PROTOCOL_VERSION,
  type BatchEvaluationRequest,
  type WorkerRequest,
  type WorkerResponse,
} from "./protocol.js";

if (parentPort === null)
  throw new Error("Node worker entry requires a parent message port.");
let activeRequestId: string | null = null;
let cancellationRequested = false;
function post(message: WorkerResponse): void {
  parentPort?.postMessage(message);
}
async function run(request: BatchEvaluationRequest): Promise<void> {
  if (activeRequestId !== null) {
    post({
      kind: "error",
      protocolVersion: WORKER_PROTOCOL_VERSION,
      requestId: request.requestId,
      message: "Worker already has an active request.",
    });
    return;
  }
  activeRequestId = request.requestId;
  cancellationRequested = false;
  try {
    post(
      await evaluateBatch(request, {
        isCancelled: () => cancellationRequested,
        onProgress: post,
        yieldControl: () =>
          new Promise((resolve) => {
            setTimeout(resolve, 0);
          }),
      }),
    );
  } catch (error) {
    post({
      kind: "error",
      protocolVersion: WORKER_PROTOCOL_VERSION,
      requestId: request.requestId,
      message: error instanceof Error ? error.message : "Unknown worker error.",
    });
  } finally {
    activeRequestId = null;
    cancellationRequested = false;
  }
}
parentPort.on("message", (request: WorkerRequest) => {
  if (request.kind === "cancel") {
    if (request.requestId === activeRequestId) cancellationRequested = true;
  } else {
    void run(request);
  }
});
