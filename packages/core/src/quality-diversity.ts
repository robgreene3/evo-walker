import {
  CONTROLLER_BOUNDS,
  createSeededController,
  validateControllerGenome,
  type JointControllerGenes,
  type PeriodicControllerGenome,
} from "./controller.js";
import { Mulberry32, type PrngState } from "./prng.js";

export interface BehaviorDescriptor {
  readonly dutyFactor: number;
  readonly diagonalCoordination: number;
}

export interface QualityDiversityEvaluation {
  readonly fitness: number;
  readonly behavior: BehaviorDescriptor;
  readonly viable: boolean;
}

export type QualityDiversityEvaluator = (
  genome: PeriodicControllerGenome,
) => QualityDiversityEvaluation;

export interface QualityDiversityConfig {
  readonly seed: number;
  readonly initialPopulation: number;
  readonly archiveBins: number;
  readonly crossoverRate: number;
  readonly mutationRate: number;
  readonly mutationScale: number;
  readonly randomInjectionRate: number;
}

export interface QualityDiversityArchiveEntry {
  readonly cellIndex: number;
  readonly xIndex: number;
  readonly yIndex: number;
  readonly genome: PeriodicControllerGenome;
  readonly fitness: number;
  readonly behavior: BehaviorDescriptor;
  readonly lineageId: string;
  readonly evaluation: number;
}

export interface QualityDiversityLineageRecord {
  readonly id: string;
  readonly evaluation: number;
  readonly genomeSeed: number;
  readonly parentIds: readonly string[];
  readonly origin: "founder" | "offspring" | "immigrant";
}

export interface QualityDiversityHistoryPoint {
  readonly evaluation: number;
  readonly bestFitness: number | null;
  readonly archiveSize: number;
  readonly archiveCoverage: number;
}

export interface QualityDiversitySnapshot {
  readonly config: QualityDiversityConfig;
  readonly evaluations: number;
  readonly archive: readonly QualityDiversityArchiveEntry[];
  readonly champion: QualityDiversityArchiveEntry | null;
  readonly lineage: readonly QualityDiversityLineageRecord[];
  readonly history: readonly QualityDiversityHistoryPoint[];
  readonly prng: PrngState;
}

export interface QualityDiversityStep {
  readonly evaluation: number;
  readonly admitted: boolean;
  readonly newCell: boolean;
  readonly championChanged: boolean;
  readonly candidate: QualityDiversityEvaluation;
  readonly snapshot: QualityDiversitySnapshot;
}

export const DEFAULT_QUALITY_DIVERSITY_CONFIG = Object.freeze({
  initialPopulation: 24,
  archiveBins: 8,
  crossoverRate: 0.75,
  mutationRate: 0.22,
  mutationScale: 0.06,
  randomInjectionRate: 0.08,
});

const TAU = 2 * Math.PI;
const UINT32_RANGE = 4_294_967_296;
const MAX_HISTORY = 512;
const MAX_LINEAGE = 4_096;

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

export function validateQualityDiversityConfig(
  config: QualityDiversityConfig,
): void {
  if (!Number.isSafeInteger(config.seed)) {
    throw new TypeError("Quality-diversity seed must be a safe integer.");
  }
  if (
    !Number.isInteger(config.initialPopulation) ||
    config.initialPopulation < 4 ||
    config.initialPopulation > 256
  ) {
    throw new RangeError("Initial population must be between 4 and 256.");
  }
  if (
    !Number.isInteger(config.archiveBins) ||
    config.archiveBins < 4 ||
    config.archiveBins > 32
  ) {
    throw new RangeError("Archive bins must be between 4 and 32.");
  }
  validateProbability(config.crossoverRate, "Crossover rate");
  validateProbability(config.mutationRate, "Mutation rate");
  validateProbability(config.randomInjectionRate, "Random injection rate");
  if (!Number.isFinite(config.mutationScale) || config.mutationScale < 0) {
    throw new RangeError("Mutation scale must be finite and non-negative.");
  }
}

function validateEvaluation(
  evaluation: QualityDiversityEvaluation,
): QualityDiversityEvaluation {
  if (!Number.isFinite(evaluation.fitness)) {
    throw new RangeError("Evaluator returned non-finite fitness.");
  }
  for (const [name, value] of Object.entries(evaluation.behavior)) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(
        `Behavior descriptor ${name} must be within [0, 1].`,
      );
    }
  }
  return Object.freeze({
    fitness: evaluation.fitness,
    viable: evaluation.viable,
    behavior: Object.freeze({ ...evaluation.behavior }),
  });
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

function mutateValue(
  value: number,
  minimum: number,
  maximum: number,
  config: QualityDiversityConfig,
  prng: Mulberry32,
  wrap = false,
): number {
  const candidate =
    prng.next() < config.mutationRate
      ? value + gaussian(prng) * config.mutationScale * (maximum - minimum)
      : value;
  return wrap ? wrapPhase(candidate) : clamp(candidate, minimum, maximum);
}

function offspring(
  left: PeriodicControllerGenome,
  right: PeriodicControllerGenome,
  seed: number,
  config: QualityDiversityConfig,
  prng: Mulberry32,
): PeriodicControllerGenome {
  const joints = left.joints.map((leftJoint, index) => {
    const rightJoint = right.joints[index];
    if (rightJoint === undefined) {
      throw new Error(`Parent did not contain joint ${index}.`);
    }
    const gene =
      prng.next() < config.crossoverRate
        ? arithmeticGene(leftJoint, rightJoint, prng)
        : leftJoint;
    return {
      amplitude: mutateValue(
        gene.amplitude,
        CONTROLLER_BOUNDS.amplitude.minimum,
        CONTROLLER_BOUNDS.amplitude.maximum,
        config,
        prng,
      ),
      frequencyHz: mutateValue(
        gene.frequencyHz,
        CONTROLLER_BOUNDS.frequencyHz.minimum,
        CONTROLLER_BOUNDS.frequencyHz.maximum,
        config,
        prng,
      ),
      phaseRadians: mutateValue(
        gene.phaseRadians,
        CONTROLLER_BOUNDS.phaseRadians.minimum,
        CONTROLLER_BOUNDS.phaseRadians.maximum,
        config,
        prng,
        true,
      ),
      offset: mutateValue(
        gene.offset,
        CONTROLLER_BOUNDS.offset.minimum,
        CONTROLLER_BOUNDS.offset.maximum,
        config,
        prng,
      ),
    };
  });
  const genome = Object.freeze({ seed, joints: Object.freeze(joints) });
  validateControllerGenome(genome);
  return genome;
}

function archiveCell(
  descriptor: BehaviorDescriptor,
  bins: number,
): { xIndex: number; yIndex: number; cellIndex: number } {
  const xIndex = Math.min(bins - 1, Math.floor(descriptor.dutyFactor * bins));
  const yIndex = Math.min(
    bins - 1,
    Math.floor(descriptor.diagonalCoordination * bins),
  );
  return { xIndex, yIndex, cellIndex: yIndex * bins + xIndex };
}

function bestOf(
  archive: ReadonlyMap<number, QualityDiversityArchiveEntry>,
): QualityDiversityArchiveEntry | null {
  let champion: QualityDiversityArchiveEntry | null = null;
  for (const entry of archive.values()) {
    if (
      champion === null ||
      entry.fitness > champion.fitness ||
      (entry.fitness === champion.fitness &&
        entry.evaluation < champion.evaluation)
    ) {
      champion = entry;
    }
  }
  return champion;
}

export class QualityDiversitySession {
  readonly #config: QualityDiversityConfig;
  readonly #evaluate: QualityDiversityEvaluator;
  readonly #archive = new Map<number, QualityDiversityArchiveEntry>();
  readonly #lineage: QualityDiversityLineageRecord[] = [];
  readonly #history: QualityDiversityHistoryPoint[] = [];
  #prng: Mulberry32;
  #evaluations = 0;

  public constructor(
    config: QualityDiversityConfig,
    evaluate: QualityDiversityEvaluator,
    checkpoint?: QualityDiversitySnapshot,
  ) {
    validateQualityDiversityConfig(config);
    this.#config = Object.freeze({ ...config });
    this.#evaluate = evaluate;
    this.#prng = new Mulberry32(config.seed);
    if (checkpoint === undefined) {
      this.#initialize();
    } else {
      if (JSON.stringify(checkpoint.config) !== JSON.stringify(this.#config)) {
        throw new RangeError(
          "Checkpoint configuration does not match the session.",
        );
      }
      this.#prng = Mulberry32.fromSnapshot(checkpoint.prng);
      this.#evaluations = checkpoint.evaluations;
      checkpoint.archive.forEach((entry) =>
        this.#archive.set(entry.cellIndex, entry),
      );
      this.#lineage.push(...checkpoint.lineage);
      this.#history.push(...checkpoint.history);
    }
  }

  #initialize(): void {
    for (let index = 0; index < this.#config.initialPopulation; index += 1) {
      const seed = index === 0 ? this.#config.seed : nextSeed(this.#prng);
      this.#evaluateCandidate(
        createSeededController(seed),
        [],
        "founder",
        false,
      );
    }
    this.#recordHistory();
  }

  #recordHistory(): void {
    const champion = bestOf(this.#archive);
    this.#history.push(
      Object.freeze({
        evaluation: this.#evaluations,
        bestFitness: champion?.fitness ?? null,
        archiveSize: this.#archive.size,
        archiveCoverage:
          this.#archive.size /
          (this.#config.archiveBins * this.#config.archiveBins),
      }),
    );
    if (this.#history.length > MAX_HISTORY) this.#history.shift();
  }

  #evaluateCandidate(
    genome: PeriodicControllerGenome,
    parentIds: readonly string[],
    origin: QualityDiversityLineageRecord["origin"],
    recordHistory: boolean,
  ): Omit<QualityDiversityStep, "snapshot"> {
    validateControllerGenome(genome);
    const previousChampion = bestOf(this.#archive);
    const evaluation = validateEvaluation(this.#evaluate(genome));
    this.#evaluations += 1;
    const lineageId = `q${String(this.#evaluations)}-${genome.seed.toString(16)}`;
    const cell = archiveCell(evaluation.behavior, this.#config.archiveBins);
    const incumbent = this.#archive.get(cell.cellIndex);
    const admitted =
      evaluation.viable &&
      (incumbent === undefined || evaluation.fitness > incumbent.fitness);
    if (admitted) {
      this.#archive.set(
        cell.cellIndex,
        Object.freeze({
          ...cell,
          genome,
          fitness: evaluation.fitness,
          behavior: evaluation.behavior,
          lineageId,
          evaluation: this.#evaluations,
        }),
      );
      this.#lineage.push(
        Object.freeze({
          id: lineageId,
          evaluation: this.#evaluations,
          genomeSeed: genome.seed,
          parentIds: Object.freeze([...parentIds]),
          origin,
        }),
      );
      if (this.#lineage.length > MAX_LINEAGE) {
        const activeIds = new Set(
          [...this.#archive.values()].map(({ lineageId: id }) => id),
        );
        const removableIndex = this.#lineage.findIndex(
          ({ id }) => !activeIds.has(id),
        );
        if (removableIndex >= 0) this.#lineage.splice(removableIndex, 1);
      }
    }
    const champion = bestOf(this.#archive);
    const championChanged = champion?.lineageId !== previousChampion?.lineageId;
    if (recordHistory && (admitted || this.#evaluations % 16 === 0)) {
      this.#recordHistory();
    }
    return {
      evaluation: this.#evaluations,
      admitted,
      newCell: admitted && incumbent === undefined,
      championChanged,
      candidate: evaluation,
    };
  }

  public advance(): QualityDiversityStep {
    const entries = [...this.#archive.values()];
    const immigrant =
      entries.length === 0 ||
      this.#prng.next() < this.#config.randomInjectionRate;
    const seed = nextSeed(this.#prng);
    let genome: PeriodicControllerGenome;
    let parentIds: readonly string[];
    if (immigrant) {
      genome = createSeededController(seed);
      parentIds = [];
    } else {
      const left = entries[Math.floor(this.#prng.next() * entries.length)];
      const right = entries[Math.floor(this.#prng.next() * entries.length)];
      if (left === undefined || right === undefined) {
        throw new Error("Archive selection did not produce parents.");
      }
      genome = offspring(
        left.genome,
        right.genome,
        seed,
        this.#config,
        this.#prng,
      );
      parentIds = Object.freeze([left.lineageId, right.lineageId]);
    }
    const step = this.#evaluateCandidate(
      genome,
      parentIds,
      immigrant ? "immigrant" : "offspring",
      true,
    );
    return Object.freeze({ ...step, snapshot: this.snapshot() });
  }

  public snapshot(): QualityDiversitySnapshot {
    const archive = [...this.#archive.values()].sort(
      (left, right) => left.cellIndex - right.cellIndex,
    );
    return Object.freeze({
      config: this.#config,
      evaluations: this.#evaluations,
      archive: Object.freeze(archive),
      champion: bestOf(this.#archive),
      lineage: Object.freeze([...this.#lineage]),
      history: Object.freeze([...this.#history]),
      prng: Object.freeze(this.#prng.snapshot()),
    });
  }
}
