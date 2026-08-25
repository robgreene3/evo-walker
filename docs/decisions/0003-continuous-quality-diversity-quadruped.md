# Decision 0003: fixed quadruped and continuous quality-diversity archive

- Status: accepted
- Date: 2026-08-09
- Scope: controller-first post-MVP correction

## Context

The verified four-joint biped completed its finite GA run but was visually repetitive: champion
replay restarted whenever worker progress changed, and many controllers moved briefly before
falling. The user requested continued, dynamic emergent evolution and explicitly authorized a
research-driven correction while retaining the controller-first boundary.

The seven original MVP slices had passed before this decision. That makes a quality-diversity
archive eligible under the repository's staging rule, but it does not authorize morphology,
neural controllers, ecology, or a backend.

## Decision

- Replace the displayed fixed biped with a fixed modular quadruped: one torso, four two-segment
  legs, eight revolute motors, and explicit feet. Only controller scalars evolve.
- Extend trials from three to six seconds and reject any archive candidate that crosses the
  persistent fall boundary. Keep component fitness visible; viability is an additional hard
  admission gate.
- Use a deterministic steady-state MAP-Elites-style archive over ground-contact duty factor and
  diagonal coordination. Each cell retains only its highest-fitness viable controller.
- Initialize with the configured seed itself plus seeded founders, then generate bounded
  crossover/mutation offspring and a small deterministic immigrant stream.
- Continue until the user pauses or stops. Yield between individual trials so controls remain
  responsive.
- Persist the archive, bounded lineage/history, configuration, and exact Mulberry32 state in a
  strict schema-v2 checkpoint. Reject schema v1 instead of guessing a migration.
- Keep the Three.js renderer mounted. Queue a new champion and adopt it only at a replay-loop
  boundary; explicit Replay remains immediate.

## Why this algorithm

MAP-Elites directly serves the experience: the user sees multiple viable gait niches accumulate
instead of watching a single scalar converge. It remains simple enough to audit and checkpoint
exactly in a low-dimensional periodic-controller search. More elaborate surrogate, neural,
gradient, or GPU methods add dependencies and hidden state without evidence that this small
deterministic search needs them.

Primary basis: Mouret and Clune, “Illuminating search spaces by mapping elites,”
<https://arxiv.org/abs/1504.04909>; Pugh, Soros, and Stanley, “Quality Diversity: A New Frontier
for Evolutionary Computation,” <https://doi.org/10.3389/frobt.2016.00040>. A 2025 survey confirms
that MAP-Elites remains a foundational QD framework while newer work expands efficiency and
representation choices: <https://doi.org/10.1016/j.swevo.2025.102240>.

## Rejected

- Evolving limb dimensions or body graphs: morphology evolution remains deferred.
- Neural controllers or deep reinforcement learning: the periodic baseline is sufficient and
  remains inspectable.
- Cosmetic “generations” or scripted improvement: evolution and niche admission must come from
  actual simulation results.
- Admitting high-progress fallen candidates: this recreates the user's observed failure mode.
- Recreating WebGL on every update: it interrupts replay and wastes main-thread work.
- Migrating version-1 documents by inference: the older snapshot lacks archive and PRNG state.

## Consequences

The default now produces visible archive growth and a viable replay during an ordinary session,
but this is still a finite-descriptor optimization sandbox, not open-ended evolution. Lineage and
history are bounded for long-running sessions. The deterministic compat physics bundle remains
large; code-splitting is a future performance trigger, not a correctness requirement.
