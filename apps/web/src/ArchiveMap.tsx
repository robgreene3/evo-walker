import type { QualityDiversitySnapshot } from "@evowalker/core";
import type { CSSProperties } from "react";

export function ArchiveMap({
  snapshot,
}: {
  readonly snapshot: QualityDiversitySnapshot | null;
}) {
  const bins = snapshot?.config.archiveBins ?? 8;
  const entries = new Map(
    snapshot?.archive.map((entry) => [entry.cellIndex, entry]),
  );
  const fitnesses = snapshot?.archive.map(({ fitness }) => fitness) ?? [];
  const minimum = fitnesses.length === 0 ? 0 : Math.min(...fitnesses);
  const span = Math.max(
    Number.EPSILON,
    (fitnesses.length === 0 ? 1 : Math.max(...fitnesses)) - minimum,
  );

  return (
    <figure className="archive-map" aria-labelledby="archive-map-title">
      <figcaption id="archive-map-title">
        Gait archive
        <span>diagonal rhythm ↑ · ground contact →</span>
      </figcaption>
      <div
        className="archive-grid"
        style={{ gridTemplateColumns: `repeat(${String(bins)}, 1fr)` }}
        role="img"
        aria-label={`${String(entries.size)} of ${String(bins * bins)} gait niches occupied.`}
      >
        {Array.from({ length: bins * bins }, (_, cellIndex) => {
          const entry = entries.get(cellIndex);
          const strength =
            entry === undefined ? 0 : (entry.fitness - minimum) / span;
          return (
            <span
              key={cellIndex}
              className={
                entry === undefined ? "archive-cell" : "archive-cell occupied"
              }
              style={
                entry === undefined
                  ? undefined
                  : ({ "--fitness": strength.toFixed(3) } as CSSProperties)
              }
              title={
                entry === undefined
                  ? "Unoccupied gait niche"
                  : `fitness ${entry.fitness.toFixed(3)} · evaluation ${String(entry.evaluation)}`
              }
            />
          );
        })}
      </div>
    </figure>
  );
}
