import { evaluateBatch } from "./evaluate-batch.js";
import {
  WORKER_PROTOCOL_VERSION,
  type BatchEvaluationRequest,
  type WorkerRequest,
  type WorkerResponse,
} from "./protocol.js";

interface WorkerScope {
  postMessage(message: WorkerResponse): void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
}

const scope = self as unknown as WorkerScope;
let activeRequestId: string | null = null;
let cancellationRequested = false;

async function run(request: BatchEvaluationRequest): Promise<void> {
  if (activeRequestId !== null) {
    scope.postMessage({
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
    scope.postMessage(
      await evaluateBatch(request, {
        isCancelled: () => cancellationRequested,
        onProgress: (message) => {
          scope.postMessage(message);
        },
        yieldControl: () =>
          new Promise((resolve) => {
            setTimeout(resolve, 0);
          }),
      }),
    );
  } catch (error) {
    scope.postMessage({
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

scope.onmessage = ({ data }) => {
  if (data.kind === "cancel") {
    if (data.requestId === activeRequestId) cancellationRequested = true;
  } else {
    void run(data);
  }
};
