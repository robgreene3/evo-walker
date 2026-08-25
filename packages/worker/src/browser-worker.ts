import {
  WORKER_PROTOCOL_VERSION,
  type BatchEvaluationRequest,
  type GeneralizationRequest,
  type ReplayEpisodeRequest,
  type StartExplorationRequest,
  type StartEvolutionRequest,
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
let pauseRequested = false;
let pausedGeneration = 0;
let pausedEvaluations = 0;
let releasePause: (() => void) | null = null;

function reportError(requestId: string, error: unknown): void {
  scope.postMessage({
    kind: "error",
    protocolVersion: WORKER_PROTOCOL_VERSION,
    requestId,
    message: error instanceof Error ? error.message : "Unknown worker error.",
  });
}

function begin(requestId: string): boolean {
  if (activeRequestId !== null) {
    scope.postMessage({
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

async function runBatch(request: BatchEvaluationRequest): Promise<void> {
  if (!begin(request.requestId)) return;
  try {
    const { evaluateBatch } = await import("./evaluate-batch.js");
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
    reportError(request.requestId, error);
  } finally {
    finish();
  }
}

async function runReplay(request: ReplayEpisodeRequest): Promise<void> {
  if (!begin(request.requestId)) return;
  try {
    const { replayEpisode } = await import("./replay-episode.js");
    scope.postMessage(replayEpisode(request));
  } catch (error) {
    reportError(request.requestId, error);
  } finally {
    finish();
  }
}

async function runGeneralization(
  request: GeneralizationRequest,
): Promise<void> {
  if (!begin(request.requestId)) return;
  try {
    const { generalizeController } = await import("./generalize-controller.js");
    scope.postMessage(generalizeController(request));
  } catch (error) {
    reportError(request.requestId, error);
  } finally {
    finish();
  }
}

async function runEvolution(request: StartEvolutionRequest): Promise<void> {
  if (!begin(request.requestId)) return;
  try {
    const { evolveExperiment } = await import("./evolve-experiment.js");
    scope.postMessage(
      await evolveExperiment(request, {
        isCancelled: () => cancellationRequested,
        onProgress: (message) => {
          pausedGeneration = message.snapshot.generation;
          scope.postMessage(message);
        },
        waitWhilePaused: async () => {
          if (!pauseRequested) return;
          scope.postMessage({
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
            scope.postMessage({
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
    const { exploreExperiment } = await import("./explore-experiment.js");
    scope.postMessage(
      await exploreExperiment(request, {
        isCancelled: () => cancellationRequested,
        onProgress: (message) => {
          pausedEvaluations = message.snapshot.evaluations;
          scope.postMessage(message);
        },
        waitWhilePaused: async () => {
          if (!pauseRequested) return;
          scope.postMessage({
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
            scope.postMessage({
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

scope.onmessage = ({ data }) => {
  if (data.requestId !== activeRequestId && activeRequestId !== null) {
    if (data.kind === "evaluate") void runBatch(data);
    if (data.kind === "replay") void runReplay(data);
    if (data.kind === "generalize") void runGeneralization(data);
    if (data.kind === "evolve") void runEvolution(data);
    if (data.kind === "explore") void runExploration(data);
    return;
  }
  switch (data.kind) {
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
      void runBatch(data);
      break;
    case "replay":
      void runReplay(data);
      break;
    case "generalize":
      void runGeneralization(data);
      break;
    case "evolve":
      void runEvolution(data);
      break;
    case "explore":
      void runExploration(data);
      break;
  }
};
