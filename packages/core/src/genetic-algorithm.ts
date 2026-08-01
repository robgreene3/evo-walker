import {
  ACTUATED_JOINT_COUNT,
  CONTROLLER_BOUNDS,
  createSeededController,
  validateControllerGenome,
  type JointControllerGenes,
  type PeriodicControllerGenome,
} from "./controller.js";
import { Mulberry32 } from "./prng.js";

export interface GeneticAlgorithmConfig {
  readonly seed: number;
  readonly populationSize: number;
  readonly generations: number;
  readonly eliteCount: number;
  readonly tournamentSize: number;
  readonly crossoverRate: number;
  readonly mutationRate: number;
  readonly mutationScale: number;
}

export interface EvaluatedController {
  readonly genome: PeriodicControllerGenome;
  readonly fitness: number;
}

export interface GenerationSummary {
  readonly generation: number;
  readonly bestFitness: number;
  readonly meanFitness: number;
  readonly champion: PeriodicControllerGenome;
}

export interface ControllerEvolutionResult {
  readonly config: GeneticAlgorithmConfig;
  readonly history: readonly GenerationSummary[];
  readonly champion: EvaluatedController;
}

export type ControllerEvaluator = (genome: PeriodicControllerGenome) => number;

export const DEFAULT_GA_CONFIG = Object.freeze({
  populationSize: 12,
  generations: 30,
  eliteCount: 2,
  tournamentSize: 3,
  crossoverRate: 0.85,
  mutationRate: 0.2,
  mutationScale: 0.08,
});

const TAU = 2 * Math.PI;
const UINT32_RANGE = 4_294_967_296;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function wrapPhase(value: number): number {
  return ((((value + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

function nextSeed(prng: Mulberry32): number {
  return Math.floor(prng.next() * UINT32_RANGE);
}

function gaussian(prng: Mulberry32): number {
  const first = Math.max(Number.EPSILON, prng.next());
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(TAU * prng.next());
}

function validateProbability(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be within [0, 1].`);
  }
}

export function validateGeneticAlgorithmConfig(
  config: GeneticAlgorithmConfig,
): void {
  if (!Number.isSafeInteger(config.seed)) {
    throw new TypeError("GA seed must be a safe integer.");
  }
  if (!Number.isInteger(config.populationSize) || config.populationSize < 2) {
    throw new RangeError("Population size must be an integer of at least 2.");
  }
  if (!Number.isInteger(config.generations) || config.generations < 1) {
    throw new RangeError("Generation count must be a positive integer.");
  }
  if (
    !Number.isInteger(config.eliteCount) ||
    config.eliteCount < 1 ||
    config.eliteCount >= config.populationSize
  ) {
    throw new RangeError(
      "Elite count must be positive and smaller than the population.",
    );
  }
  if (
    !Number.isInteger(config.tournamentSize) ||
    config.tournamentSize < 2 ||
    config.tournamentSize > config.populationSize
  ) {
    throw new RangeError(
      "Tournament size must be between 2 and the population size.",
    );
  }
  validateProbability(config.crossoverRate, "Crossover rate");
  validateProbability(config.mutationRate, "Mutation rate");
  if (!Number.isFinite(config.mutationScale) || config.mutationScale < 0) {
    throw new RangeError("Mutation scale must be finite and non-negative.");
  }
}

function rankPopulation(
  population: readonly PeriodicControllerGenome[],
  evaluate: ControllerEvaluator,
): EvaluatedController[] {
  return population
    .map((genome, index) => {
      validateControllerGenome(genome);
      const fitness = evaluate(genome);
      if (!Number.isFinite(fitness)) {
        throw new RangeError(
          `Evaluator returned non-finite fitness at ${index}.`,
        );
      }
      return { genome, fitness, index };
    })
    .sort(
      (left, right) => right.fitness - left.fitness || left.index - right.index,
    )
    .map(({ genome, fitness }) => Object.freeze({ genome, fitness }));
}

function selectTournament(
  ranked: readonly EvaluatedController[],
  tournamentSize: number,
  prng: Mulberry32,
): PeriodicControllerGenome {
  let winner: EvaluatedController | undefined;
  for (let index = 0; index < tournamentSize; index += 1) {
    const candidate = ranked[Math.floor(prng.next() * ranked.length)];
    if (
      candidate !== undefined &&
      (winner === undefined || candidate.fitness > winner.fitness)
    ) {
      winner = candidate;
    }
  }
  if (winner === undefined) {
    throw new Error("Tournament selection did not produce a parent.");
  }
  return winner.genome;
}

function arithmeticGene(
  left: JointControllerGenes,
  right: JointControllerGenes,
  prng: Mulberry32,
): JointControllerGenes {
  const mix = (first: number, second: number): number => {
    const weight = prng.next();
    return first * weight + second * (1 - weight);
  };
  return {
    amplitude: mix(left.amplitude, right.amplitude),
    frequencyHz: mix(left.frequencyHz, right.frequencyHz),
    phaseRadians: wrapPhase(mix(left.phaseRadians, right.phaseRadians)),
    offset: mix(left.offset, right.offset),
  };
}

function crossover(
  left: PeriodicControllerGenome,
  right: PeriodicControllerGenome,
  seed: number,
  crossoverRate: number,
  prng: Mulberry32,
): PeriodicControllerGenome {
  const joints = left.joints.map((leftJoint, index) => {
    const rightJoint = right.joints[index];
    if (rightJoint === undefined) {
      throw new Error(`Parent did not contain joint ${index}.`);
    }
    return prng.next() < crossoverRate
      ? arithmeticGene(leftJoint, rightJoint, prng)
      : { ...leftJoint };
  });
  return { seed, joints };
}

function mutateValue(
  value: number,
  minimum: number,
  maximum: number,
  config: GeneticAlgorithmConfig,
  prng: Mulberry32,
  wrap = false,
): number {
  const mutated =
    prng.next() < config.mutationRate
      ? value + gaussian(prng) * config.mutationScale * (maximum - minimum)
      : value;
  return wrap ? wrapPhase(mutated) : clamp(mutated, minimum, maximum);
}

function mutate(
  genome: PeriodicControllerGenome,
  config: GeneticAlgorithmConfig,
  prng: Mulberry32,
): PeriodicControllerGenome {
  const joints = genome.joints.map((joint) => ({
    amplitude: mutateValue(
      joint.amplitude,
      CONTROLLER_BOUNDS.amplitude.minimum,
      CONTROLLER_BOUNDS.amplitude.maximum,
      config,
      prng,
    ),
    frequencyHz: mutateValue(
      joint.frequencyHz,
      CONTROLLER_BOUNDS.frequencyHz.minimum,
      CONTROLLER_BOUNDS.frequencyHz.maximum,
      config,
      prng,
    ),
    phaseRadians: mutateValue(
      joint.phaseRadians,
      CONTROLLER_BOUNDS.phaseRadians.minimum,
      CONTROLLER_BOUNDS.phaseRadians.maximum,
      config,
      prng,
      true,
    ),
    offset: mutateValue(
      joint.offset,
      CONTROLLER_BOUNDS.offset.minimum,
      CONTROLLER_BOUNDS.offset.maximum,
      config,
      prng,
    ),
  }));
  const mutated = { seed: genome.seed, joints };
  validateControllerGenome(mutated);
  return mutated;
}

function summarize(
  generation: number,
  ranked: readonly EvaluatedController[],
): GenerationSummary {
  const champion = ranked[0];
  if (champion === undefined) {
    throw new Error("Cannot summarize an empty population.");
  }
  return Object.freeze({
    generation,
    bestFitness: champion.fitness,
    meanFitness:
      ranked.reduce((sum, candidate) => sum + candidate.fitness, 0) /
      ranked.length,
    champion: champion.genome,
  });
}

export function evolveControllerPopulation(
  config: GeneticAlgorithmConfig,
  evaluate: ControllerEvaluator,
): ControllerEvolutionResult {
  validateGeneticAlgorithmConfig(config);
  const prng = new Mulberry32(config.seed);
  let population = Array.from({ length: config.populationSize }, () =>
    createSeededController(nextSeed(prng)),
  );
  let ranked = rankPopulation(population, evaluate);
  const history: GenerationSummary[] = [summarize(0, ranked)];

  for (let generation = 1; generation <= config.generations; generation += 1) {
    const nextPopulation = ranked
      .slice(0, config.eliteCount)
      .map(({ genome }) => genome);
    while (nextPopulation.length < config.populationSize) {
      const left = selectTournament(ranked, config.tournamentSize, prng);
      const right = selectTournament(ranked, config.tournamentSize, prng);
      const child = crossover(
        left,
        right,
        nextSeed(prng),
        config.crossoverRate,
        prng,
      );
      nextPopulation.push(mutate(child, config, prng));
    }
    population = nextPopulation;
    ranked = rankPopulation(population, evaluate);
    history.push(summarize(generation, ranked));
  }

  const champion = ranked[0];
  if (champion === undefined) {
    throw new Error("Evolution did not produce a champion.");
  }
  return Object.freeze({
    config: Object.freeze({ ...config }),
    history: Object.freeze(history),
    champion,
  });
}

export function genomeScalarCount(): number {
  return ACTUATED_JOINT_COUNT * 4;
}
