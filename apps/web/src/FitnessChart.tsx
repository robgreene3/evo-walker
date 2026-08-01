import type { GenerationSummary } from "@evowalker/core";

interface FitnessChartProps {
  readonly history: readonly GenerationSummary[];
}

const WIDTH = 600;
const HEIGHT = 180;
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
  const best = history.map(({ bestFitness }) => bestFitness);
  const median = history.map(({ medianFitness }) => medianFitness);
  const values = [...best, ...median];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = Math.max(Number.EPSILON, maximum - minimum);

  return (
    <figure className="fitness-chart" aria-labelledby="fitness-chart-title">
      <figcaption id="fitness-chart-title">
        Fitness history
        <span className="chart-legend" aria-hidden="true">
          <i className="legend-best" /> best <i className="legend-median" />{" "}
          median
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Best fitness ${best.at(-1)?.toFixed(3)} and median fitness ${median.at(-1)?.toFixed(3)} at generation ${history.length - 1}.`}
      >
        <line
          x1={PADDING}
          y1={HEIGHT - PADDING}
          x2={WIDTH - PADDING}
          y2={HEIGHT - PADDING}
        />
        <polyline
          className="median-line"
          points={points(median, minimum, span)}
        />
        <polyline className="best-line" points={points(best, minimum, span)} />
      </svg>
    </figure>
  );
}
