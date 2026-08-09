import { validateControllerGenome } from "@evowalker/core";
import { runDeterministicEpisode } from "@evowalker/sim";
import {
  WORKER_PROTOCOL_VERSION,
  type ReplayEpisodeCompletedMessage,
  type ReplayEpisodeRequest,
} from "./protocol.js";

export function replayEpisode(
  request: ReplayEpisodeRequest,
): ReplayEpisodeCompletedMessage {
  if (request.protocolVersion !== WORKER_PROTOCOL_VERSION)
    throw new RangeError("Unsupported worker protocol version.");
  if (request.requestId.length === 0 || request.requestId.length > 128)
    throw new RangeError("Worker request ID must contain 1 to 128 characters.");
  validateControllerGenome(request.genome);
  return {
    kind: "replay-completed",
    protocolVersion: WORKER_PROTOCOL_VERSION,
    requestId: request.requestId,
    episode: runDeterministicEpisode(request.genome),
  };
}
