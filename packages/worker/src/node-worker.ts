import { parentPort } from "node:worker_threads";
import { evaluateBatch } from "./evaluate-batch.js";
import { evolveExperiment } from "./evolve-experiment.js";
import { exploreExperiment } from "./explore-experiment.js";
import {
  WORKER_PROTOCOL_VERSION,
  type BatchEvaluationRequest,
  type StartExplorationRequest,
  type StartEvolutionRequest,
  type WorkerRequest,
  type WorkerResponse,
} from "./protocol.js";

if (parentPort === null)
  throw new Error("Node worker entry requires a parent message port.");
let activeRequestId: string | null = null;
let cancellationRequested = false;
let pauseRequested = false;
let pausedGeneration = 0;
let pausedEvaluations = 0;
let releasePause: (() => void) | null = null;
function post(message: WorkerResponse): void {
  parentPort?.postMessage(message);
}
function begin(requestId: string): boolean {
  if (activeRequestId !== null) {
    post({
      kind: "error",
      protocolVersion: WORKER_PROTOCOL_VERSION,
      requestId,
      message: "Worker already has an active request.",
    });
    return false;
  }
  activeRequestId = requestId;
  cancellationRequested = false;
  pauseRequested = false;
  return true;
}
function finish(): void {
  activeRequestId = null;
  cancellationRequested = false;
  pauseRequested = false;
  releasePause = null;
}
function reportError(requestId: string, error: unknown): void {
  post({
    kind: "error",
    protocolVersion: WORKER_PROTOCOL_VERSION,
    requestId,
    message: error instanceof Error ? error.message : "Unknown worker error.",
  });
}
async function runBatch(request: BatchEvaluationRequest): Promise<void> {
  if (!begin(request.requestId)) return;
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
    reportError(request.requestId, error);
  } finally {
    finish();
  }
}
async function runEvolution(request: StartEvolutionRequest): Promise<void> {
  if (!begin(request.requestId)) return;
  try {
    post(
      await evolveExperiment(request, {
        isCancelled: () => cancellationRequested,
        onProgress: (message) => {
          pausedGeneration = message.snapshot.generation;
          post(message);
        },
        waitWhilePaused: async () => {
          if (!pauseRequested) return;
          post({
            kind: "evolution-paused",
            protocolVersion: WORKER_PROTOCOL_VERSION,
            requestId: request.requestId,
            generation: pausedGeneration,
          });
          await new Promise<void>((resolve) => {
            releasePause = resolve;
          });
          releasePause = null;
          if (!cancellationRequested) {
            post({
              kind: "evolution-resumed",
              protocolVersion: WORKER_PROTOCOL_VERSION,
              requestId: request.requestId,
              generation: pausedGeneration,
            });
          }
        },
        yieldControl: () =>
          new Promise((resolve) => {
            setTimeout(resolve, 0);
          }),
      }),
    );
  } catch (error) {
    reportError(request.requestId, error);
  } finally {
    finish();
  }
}
async function runExploration(request: StartExplorationRequest): Promise<void> {
  if (!begin(request.requestId)) return;
  try {
    post(
      await exploreExperiment(request, {
        isCancelled: () => cancellationRequested,
        onProgress: (message) => {
          pausedEvaluations = message.snapshot.evaluations;
          post(message);
        },
        waitWhilePaused: async () => {
          if (!pauseRequested) return;
          post({
            kind: "exploration-paused",
            protocolVersion: WORKER_PROTOCOL_VERSION,
            requestId: request.requestId,
            evaluations: pausedEvaluations,
          });
          await new Promise<void>((resolve) => {
            releasePause = resolve;
          });
          releasePause = null;
          if (!cancellationRequested) {
            post({
              kind: "exploration-resumed",
              protocolVersion: WORKER_PROTOCOL_VERSION,
              requestId: request.requestId,
              evaluations: pausedEvaluations,
            });
          }
        },
        yieldControl: () =>
          new Promise((resolve) => {
            setTimeout(resolve, 0);
          }),
      }),
    );
  } catch (error) {
    reportError(request.requestId, error);
  } finally {
    finish();
  }
}
parentPort.on("message", (request: WorkerRequest) => {
  if (request.requestId !== activeRequestId && activeRequestId !== null) {
    if (request.kind === "evaluate") void runBatch(request);
    if (request.kind === "evolve") void runEvolution(request);
    if (request.kind === "explore") void runExploration(request);
    return;
  }
  switch (request.kind) {
    case "cancel":
      cancellationRequested = true;
      releasePause?.();
      break;
    case "pause":
      pauseRequested = true;
      break;
    case "resume":
      pauseRequested = false;
      releasePause?.();
      break;
    case "evaluate":
      void runBatch(request);
      break;
    case "evolve":
      void runEvolution(request);
      break;
    case "explore":
      void runExploration(request);
      break;
  }
});
