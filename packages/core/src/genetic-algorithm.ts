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
  readonly lineageId: string;
}

export interface ControllerLineageRecord {
  readonly id: string;
  readonly generation: number;
  readonly genomeSeed: number;
  readonly parentIds: readonly string[];
  readonly eliteCarryover: boolean;
}

export interface GenerationSummary {
  readonly generation: number;
  readonly bestFitness: number;
  readonly medianFitness: number;
  readonly meanFitness: number;
  readonly duplicateRate: number;
  readonly meanGenotypeDistance: number;
  readonly championLineageId: string;
  readonly champion: PeriodicControllerGenome;
}

export interface ControllerEvolutionResult {
  readonly config: GeneticAlgorithmConfig;
  readonly history: readonly GenerationSummary[];
  readonly champion: EvaluatedController;
  readonly lineage: readonly ControllerLineageRecord[];
}

interface PopulationMember {
  readonly genome: PeriodicControllerGenome;
  readonly lineageId: string;
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
  population: readonly PopulationMember[],
  evaluate: ControllerEvaluator,
): EvaluatedController[] {
  return population
    .map(({ genome, lineageId }, index) => {
      validateControllerGenome(genome);
      const fitness = evaluate(genome);
      if (!Number.isFinite(fitness)) {
        throw new RangeError(
          `Evaluator returned non-finite fitness at ${index}.`,
        );
      }
      return { genome, fitness, lineageId, index };
    })
    .sort(
      (left, right) => right.fitness - left.fitness || left.index - right.index,
    )
    .map(({ genome, fitness, lineageId }) =>
      Object.freeze({ genome, fitness, lineageId }),
    );
}

function selectTournament(
  ranked: readonly EvaluatedController[],
  tournamentSize: number,
  prng: Mulberry32,
): EvaluatedController {
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
  return winner;
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
  const orderedFitness = ranked
    .map(({ fitness }) => fitness)
    .sort((a, b) => a - b);
  const middle = Math.floor(orderedFitness.length / 2);
  const lower = orderedFitness[middle - 1] ?? orderedFitness[middle];
  const upper = orderedFitness[middle];
  if (lower === undefined || upper === undefined) {
    throw new Error("Cannot summarize missing fitness values.");
  }
  const genomeKeys = ranked.map(({ genome }) =>
    genome.joints
      .flatMap(({ amplitude, frequencyHz, phaseRadians, offset }) => [
        amplitude,
        frequencyHz,
        phaseRadians,
        offset,
      ])
      .join(","),
  );
  let pairDistance = 0;
  let pairCount = 0;
  for (let left = 0; left < ranked.length; left += 1) {
    for (let right = left + 1; right < ranked.length; right += 1) {
      const leftGenome = ranked[left]?.genome;
      const rightGenome = ranked[right]?.genome;
      if (leftGenome === undefined || rightGenome === undefined) continue;
      let scalarDistance = 0;
      leftGenome.joints.forEach((joint, jointIndex) => {
        const other = rightGenome.joints[jointIndex];
        if (other === undefined)
          throw new Error("Genome length changed during summary.");
        scalarDistance += Math.abs(joint.amplitude - other.amplitude) / 1.8;
        scalarDistance +=
          Math.abs(joint.frequencyHz - other.frequencyHz) / 2.25;
        const phaseDifference = Math.abs(
          joint.phaseRadians - other.phaseRadians,
        );
        scalarDistance +=
          Math.min(phaseDifference, TAU - phaseDifference) / Math.PI;
        scalarDistance += Math.abs(joint.offset - other.offset) / 0.8;
      });
      pairDistance += scalarDistance / genomeScalarCount();
      pairCount += 1;
    }
  }
  return Object.freeze({
    generation,
    bestFitness: champion.fitness,
    medianFitness: (lower + upper) / 2,
    meanFitness:
      ranked.reduce((sum, candidate) => sum + candidate.fitness, 0) /
      ranked.length,
    duplicateRate: 1 - new Set(genomeKeys).size / ranked.length,
    meanGenotypeDistance: pairCount === 0 ? 0 : pairDistance / pairCount,
    championLineageId: champion.lineageId,
    champion: champion.genome,
  });
}

export function evolveControllerPopulation(
  config: GeneticAlgorithmConfig,
  evaluate: ControllerEvaluator,
): ControllerEvolutionResult {
  validateGeneticAlgorithmConfig(config);
  const prng = new Mulberry32(config.seed);
  const lineage: ControllerLineageRecord[] = [];
  let population = Array.from({ length: config.populationSize }, (_, index) => {
    const genome = createSeededController(nextSeed(prng));
    const lineageId = `g0-i${index}`;
    lineage.push(
      Object.freeze({
        id: lineageId,
        generation: 0,
        genomeSeed: genome.seed,
        parentIds: Object.freeze([]),
        eliteCarryover: false,
      }),
    );
    return { genome, lineageId };
  });
  let ranked = rankPopulation(population, evaluate);
  const history: GenerationSummary[] = [summarize(0, ranked)];

  for (let generation = 1; generation <= config.generations; generation += 1) {
    const nextPopulation: PopulationMember[] = ranked
      .slice(0, config.eliteCount)
      .map((elite, index) => {
        const lineageId = `g${generation}-i${index}`;
        lineage.push(
          Object.freeze({
            id: lineageId,
            generation,
            genomeSeed: elite.genome.seed,
            parentIds: Object.freeze([elite.lineageId]),
            eliteCarryover: true,
          }),
        );
        return { genome: elite.genome, lineageId };
      });
    while (nextPopulation.length < config.populationSize) {
      const left = selectTournament(ranked, config.tournamentSize, prng);
      const right = selectTournament(ranked, config.tournamentSize, prng);
      const lineageId = `g${generation}-i${nextPopulation.length}`;
      const child = crossover(
        left.genome,
        right.genome,
        nextSeed(prng),
        config.crossoverRate,
        prng,
      );
      const genome = mutate(child, config, prng);
      lineage.push(
        Object.freeze({
          id: lineageId,
          generation,
          genomeSeed: genome.seed,
          parentIds: Object.freeze([left.lineageId, right.lineageId]),
          eliteCarryover: false,
        }),
      );
      nextPopulation.push({ genome, lineageId });
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
    lineage: Object.freeze(lineage),
  });
}

export function genomeScalarCount(): number {
  return ACTUATED_JOINT_COUNT * 4;
}
