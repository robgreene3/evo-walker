import type { QualityDiversityHistoryPoint } from "@evowalker/core";

interface FitnessChartProps {
  readonly history: readonly QualityDiversityHistoryPoint[];
}

const WIDTH = 600;
const HEIGHT = 150;
const PADDING = 18;

function points(
  values: readonly number[],
  minimum: number,
  span: number,
): string {
  const xSpan = Math.max(1, values.length - 1);
  return values
    .map((value, index) => {
      const x = PADDING + (index / xSpan) * (WIDTH - PADDING * 2);
      const y =
        HEIGHT - PADDING - ((value - minimum) / span) * (HEIGHT - PADDING * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function FitnessChart({ history }: FitnessChartProps) {
  if (history.length === 0) return null;
  const best = history.map(({ bestFitness }) => bestFitness ?? 0);
  const minimum = Math.min(...best);
  const maximum = Math.max(...best);
  const span = Math.max(Number.EPSILON, maximum - minimum);
  const latest = history.at(-1);

  return (
    <figure className="fitness-chart" aria-labelledby="fitness-chart-title">
      <figcaption id="fitness-chart-title">
        Viable champion history<span>rolling checkpoint evidence</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Best viable fitness ${latest?.bestFitness?.toFixed(3) ?? "not available"} after ${String(latest?.evaluation ?? 0)} evaluations.`}
      >
        <line
          x1={PADDING}
          y1={HEIGHT - PADDING}
          x2={WIDTH - PADDING}
          y2={HEIGHT - PADDING}
        />
        <polyline className="best-line" points={points(best, minimum, span)} />
      </svg>
    </figure>
  );
}
