import { createSeededController } from "@evowalker/core";

import { DeterministicCreatureEpisode } from "./index.js";

const seed = 7_311;
const episode = new DeterministicCreatureEpisode(createSeededController(seed));

try {
  const first = episode.run();
  const replay = episode.replay();
  process.stdout.write(
    `${JSON.stringify(
      {
        seed,
        aggregateFitness: first.aggregateFitness,
        components: first.components,
        frames: first.frames.length,
        finalWorldChecksum: first.finalWorldChecksum,
        replayChecksum: replay.finalWorldChecksum,
        replayEquivalent:
          first.finalWorldChecksum === replay.finalWorldChecksum,
        invalidReason: first.invalidReason,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  episode.dispose();
}
