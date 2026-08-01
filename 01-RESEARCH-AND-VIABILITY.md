# EvoWalker: Research and Viability Analysis

## Executive decision

The project is viable **if it is framed as a modern spiritual successor to breve Walker rather than a direct port**.

The strongest first release is a browser-based artificial-life laboratory in which modular rigid-body creatures evolve locomotion controllers and, after the locomotion pipeline is proven, constrained body plans. The player can observe generations, inspect genomes and ancestry, save champions, alter selection pressures, and run reproducible experiments.

A direct feature-for-feature reimplementation of the original breve environment is not recommended. It would spend effort recreating an old general-purpose simulation platform instead of delivering the distinctive experience: visible evolution of embodied creatures.

## What the original established

The original breve project was an open-source 3D environment for multi-agent and artificial-life simulations in continuous time and space. Its Walker demo used physically simulated articulated creatures and a genetic algorithm to evolve walking behavior. The related SuperDuperWalker teaching framework exposed evolutionary parameters through a GUI and displayed the agents in real time.

This gives the new project a clear historical anchor:

- real-time 3D rigid-body simulation;
- embodied agents made from connected parts;
- heritable control parameters;
- population-based selection, crossover, and mutation;
- an observable generation loop rather than a scripted animation.

## Product thesis

**EvoWalker is an interactive evolutionary robotics sandbox, not a virtual pet game.**

The emotional appeal comes from watching lineages struggle, improve, specialize, and occasionally discover surprising movement. The scientific appeal comes from reproducibility, inspectable genomes, explicit fitness functions, and experiment history.

The critical journey is:

1. Start a seeded experiment.
2. Watch a population attempt locomotion.
3. See fitness improve across generations.
4. Inspect the current champion and its lineage.
5. change one environmental or evolutionary parameter;
6. compare the resulting run against the baseline;
7. save or export a reproducible experiment.

## Recommended product scope

### Release 0: feasibility spike

Prove that one articulated creature can be simulated reliably and controlled by a parameterized gait.

Required:

- ground plane, gravity, camera, lights;
- one fixed-topology creature with 4-8 actuated joints;
- deterministic seeded controller parameters;
- fixed-duration evaluation episode;
- fitness based primarily on forward displacement with penalties for instability and energy use;
- reset without memory or physics-state leakage;
- headless or accelerated batch evaluation.

Falsifier: if repeated runs with the same seed and configuration produce materially different rankings, the architecture is not ready for evolutionary experiments.

### Release 1: locomotion evolution MVP

Evolve controllers for one or a small set of fixed body plans.

Required:

- population, selection, crossover, mutation, elitism;
- deterministic pseudo-random number generator owned by the simulation layer;
- worker-based evaluation so training does not freeze the UI;
- live champion preview plus compact generation statistics;
- pause, resume, restart, speed control;
- experiment configuration, seed, and versioned save format;
- export/import JSON;
- automated evidence that median and best fitness improve on a known benchmark seed set.

### Release 2: constrained morphology evolution

Add body evolution only after Release 1 is stable.

Use a bounded graph genome:

- nodes represent rigid body segments;
- edges represent joints;
- hard limits on segment count, mass, dimensions, joint range, and symmetry;
- repair invalid offspring or reject them deterministically;
- separate morphology genes from controller genes;
- complexity penalty to prevent uncontrolled body growth.

Avoid unconstrained open-ended morphology in the first implementation. It creates invalid bodies, exploitative physics behaviors, unstable evaluation, and an enormous search space.

### Release 3: artificial-life sandbox features

Potential later additions:

- multiple terrains and gravity presets;
- task switching: forward travel, turning, climbing, balance, obstacle traversal;
- novelty search or quality-diversity archives;
- species clustering and lineage visualization;
- resources, energy budgets, reproduction, and ecology;
- a calmer pet-like observation mode built on top of the evolutionary system.

These are explicitly post-MVP.

## Technical architecture recommendation

### Primary stack

- **TypeScript** for the application and simulation orchestration.
- **Vite** for development and production bundling.
- **React** for panels, controls, experiment history, and inspection UI.
- **Three.js** for rendering.
- **Rapier 3D WASM** for rigid-body physics and joints.
- **Web Workers** for off-main-thread population evaluation.
- **Vitest** for unit and integration tests.
- **Playwright** for the critical browser journey and visual/runtime checks.
- **Zod** or equivalent schema validation for versioned experiment files.

### Why this stack

A web build lowers distribution friction and makes the evolving creature immediately inspectable. Three.js and Rapier separate rendering from physics, workers support batch evaluation, and TypeScript allows the genome, evolutionary engine, save schema, and UI to share explicit contracts.

The architecture should keep the simulation core independent from React and Three.js. Rendering observes snapshots; it must not own simulation truth.

### Architectural boundaries

1. `packages/core`
   - deterministic PRNG;
   - genome types and validation;
   - controller evaluation;
   - fitness computation;
   - genetic operators;
   - experiment configuration and serialization.

2. `packages/sim`
   - Rapier world construction;
   - creature phenotype construction from genome;
   - episode stepping and reset;
   - simulation snapshots;
   - deterministic evaluation harness.

3. `packages/worker`
   - batch evaluation protocol;
   - worker pool;
   - cancellation and progress reporting;
   - no UI imports.

4. `apps/web`
   - Three.js scene and champion playback;
   - React controls and charts;
   - save/load/export;
   - accessibility and responsive layout.

5. `packages/benchmarks`
   - canonical seeds and configurations;
   - reproducibility tests;
   - expected statistical envelopes, not brittle exact scores.

## Evolution design

### Controller baseline

Begin with a compact periodic controller rather than a neural network:

- each actuated joint has amplitude, frequency, phase, offset, and optional sensor coupling;
- outputs are clamped to joint limits;
- controller complexity remains inspectable;
- evolution can make visible progress in a reasonable amount of time.

A small neural controller can be added later as a comparative experiment, not as the initial dependency.

### Genetic algorithm baseline

- population: configurable, conservative default;
- selection: tournament selection;
- elitism: retain a small number of top genomes;
- crossover: uniform or arithmetic crossover for controller vectors;
- mutation: per-gene Gaussian perturbation with bounded values;
- diversity: track genotype distance and duplicate rate;
- termination: user stop, generation cap, or plateau rule;
- all random choices derive from a persisted seed.

### Fitness

Use a multi-term, explicitly reported fitness function:

`fitness = progress - fallPenalty - energyPenalty - lateralDriftPenalty + uprightBonus`

Guard against common exploits:

- measure centre-of-mass progress, not the furthest body part;
- ignore ballistic launch during a short settling interval;
- cap or normalize extreme impulses;
- penalize invalid bodies and simulation instability;
- record each component so the user can understand why a genome won.

Do not use one opaque aggregate without component telemetry.

## Reproducibility requirements

Perfect cross-browser bitwise determinism may not be realistic for a floating-point physics engine. The project should instead define and test two levels:

1. **Run determinism in one supported environment**: same build, browser/runtime, seed, and configuration produce equivalent rankings and closely bounded metrics.
2. **Statistical reproducibility across supported environments**: benchmark runs fall within documented envelopes and preserve the qualitative conclusion that evolution improves performance.

Persist:

- application version and schema version;
- seed and PRNG algorithm;
- physics timestep and substeps;
- complete experiment configuration;
- genome and lineage data;
- fitness components;
- environment/browser metadata when exporting diagnostics.

## Performance strategy

Do not simulate every creature visually. Evaluate populations in workers without rendering, then replay selected genomes in the visible scene.

Use:

- fixed timestep;
- bounded episode length;
- worker pool sized conservatively;
- transferable compact genome/config data;
- throttled progress messages;
- profiling before optimization;
- optional fast-forward with rendering decoupled from simulation steps.

A practical MVP target is a responsive UI while evaluating a moderate population, not millions of agents.

## Main risks and mitigations

| Risk | Consequence | Mitigation |
|---|---|---|
| Physics nondeterminism | irreproducible rankings | fixed timestep, owned PRNG, canonical environment, tolerance-based tests |
| Search-space explosion | no visible learning | fixed morphology first, compact controller, bounded parameters |
| Invalid evolved bodies | crashes or meaningless runs | schema constraints, repair/rejection, validation tests |
| Reward hacking | creatures exploit physics instead of walking | component fitness, replay inspection, adversarial benchmark cases |
| Main-thread load | frozen interface | worker evaluation, champion-only rendering |
| Scope creep into ecology/game systems | unfinished core | staged releases and hard MVP exclusions |
| Misleading scientific presentation | false claims of discovery | describe the tool as an educational/creative sandbox; expose assumptions and limits |
| Dependency/licence uncertainty | release risk | verify current licences and lock dependency versions before implementation |

## Definition of done for the first complete product

The first complete product is done when:

- a new user can start a seeded locomotion experiment without documentation;
- a population evolves for at least 30 generations without UI lockup or simulation corruption;
- best fitness improves over the initial generation on a documented benchmark suite often enough to meet the preset statistical gate;
- the champion can be replayed, inspected, named, saved, exported, imported, and replayed again;
- the experiment is reproducible within documented tolerance in the supported environment;
- invalid files and incompatible schema versions fail safely with useful messages;
- desktop and mobile layouts support the critical journey;
- keyboard navigation, visible focus, semantic controls, reduced-motion behavior, and accessible names are verified;
- unit, integration, end-to-end, type, lint, and production-build checks pass;
- the repository includes architecture, experiment format, algorithm, testing, limitations, and recovery documentation.

## Research-informed conclusion

The idea is technically and product-wise sound. The key is to **stage complexity**:

1. prove stable articulated simulation;
2. evolve controllers on fixed bodies;
3. prove reproducibility and visible improvement;
4. only then evolve morphology;
5. add artificial-life and pet-like layers after the engine earns them.

That sequence preserves the spirit of breve Walker while producing something modern, distributable, inspectable, and feasible for a coding agent to construct end to end.

## Source starting points

- Jon Klein, `jonklein/breve`: original open-source breve simulation environment.
- Jon Klein, *breve: a 3D environment for the simulation of decentralized systems and artificial life*.
- Hampshire College, *SuperDuperWalker*: evolutionary locomotion teaching framework.
- International Society for Artificial Life, *Evolutionary Robotics* overview.
- OpenAI, *Codex Best Practices* and *Codex Prompting Guide*.

Before implementation, Codex must verify current package APIs, licences, browser support, and version compatibility from official project documentation and package metadata.
