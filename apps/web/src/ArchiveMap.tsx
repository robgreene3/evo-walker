import type {
  QualityDiversityArchiveEntry,
  QualityDiversitySnapshot,
} from "@evowalker/core";
import type { CSSProperties } from "react";

export function ArchiveMap({
  snapshot,
  selectedLineageId,
  onSelect,
}: {
  readonly snapshot: QualityDiversitySnapshot | null;
  readonly selectedLineageId: string | null;
  readonly onSelect: (entry: QualityDiversityArchiveEntry) => void;
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
        aria-label={`${String(entries.size)} of ${String(bins * bins)} gait niches occupied.`}
      >
        {Array.from({ length: bins * bins }, (_, cellIndex) => {
          const entry = entries.get(cellIndex);
          const strength =
            entry === undefined ? 0 : (entry.fitness - minimum) / span;
          if (entry === undefined)
            return (
              <span
                key={cellIndex}
                className="archive-cell"
                title="Unoccupied gait niche"
                aria-hidden="true"
              />
            );
          const selected = selectedLineageId === entry.lineageId;
          return (
            <button
              key={cellIndex}
              type="button"
              className={`archive-cell occupied${selected ? " selected" : ""}`}
              style={{ "--fitness": strength.toFixed(3) } as CSSProperties}
              aria-pressed={selected}
              aria-label={`Gait niche: ground contact ${entry.behavior.dutyFactor.toFixed(3)}, diagonal rhythm ${entry.behavior.diagonalCoordination.toFixed(3)}, fitness ${entry.fitness.toFixed(3)}, evaluation ${String(entry.evaluation)}`}
              title={`Replay gait · fitness ${entry.fitness.toFixed(3)} · evaluation ${String(entry.evaluation)}`}
              onClick={() => {
                onSelect(entry);
              }}
            />
          );
        })}
      </div>
    </figure>
  );
}
